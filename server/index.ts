import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { WebhookHandlers } from "./webhookHandlers";
import { setupMcpServer } from "./mcp";
import { injectSeoIntoHtml, isNoIndexPath } from "./publicRouteSeo";

const SPA_ROUTE_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/login$/,
  /^\/register(\/.*)?$/,
  /^\/features$/,
  /^\/documentation$/,
  /^\/manual$/,
  /^\/faq$/,
  /^\/acesso(\/.*)?$/,
  /^\/join\/.+$/,
  /^\/immediate-consultation$/,
  /^\/mode-selection$/,
  /^\/dashboard$/,
  /^\/profile$/,
  /^\/patients(\/.*)?$/,
  /^\/schedule$/,
  /^\/whatsapp$/,
  /^\/records$/,
  /^\/prescriptions$/,
  /^\/analytics$/,
  /^\/admin(\/.*)?$/,
  /^\/reports$/,
  /^\/consultation(\/.*)?$/,
  /^\/patient\/video\/.+$/,
  /^\/patient-agenda$/,
  /^\/consultation-request$/,
  /^\/my-consultations$/,
  /^\/consultation-session\/.+$/,
  /^\/post-consultation-review$/,
  /^\/diagnostic-review$/,
  /^\/wallet$/,
  /^\/clinical-dashboard$/,
  /^\/assistant$/,
  /^\/medical-references$/,
  /^\/doctor-availability$/,
  /^\/doctor-referrals$/,
  /^\/doctor-notes$/,
  /^\/doctor-chat$/,
  /^\/medical-teams$/,
  /^\/team-room\/.+$/,
  /^\/medical-cafe$/,
  /^\/doctor-office$/,
  /^\/coffee-room$/,
  /^\/inter-consultation$/,
  /^\/epidemiological-reports$/,
  /^\/incomplete-consultations$/,
  /^\/nft-management$/,
  /^\/pharmacy(\/.*)?$/,
  /^\/broker$/,
  /^\/credits$/,
  /^\/clinics$/,
  /^\/fhir-dashboard$/,
  /^\/installation$/,
];

function isKnownSpaRoute(pathname: string): boolean {
  return SPA_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

const app = express();

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing stripe-signature' });

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        return res.status(500).json({ error: 'Webhook processing error' });
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Stripe webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false, limit: '20mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.setHeader('Content-Language', 'pt-BR');
  next();
});

app.use((req, res, next) => {
  if (isNoIndexPath(req.path)) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  setupMcpServer(app);

  const server = await registerRoutes(app);

  // Add API protection middleware before error handler and Vite setup
  app.use('/api/*', (req, res, next) => {
    // This ensures API routes are never intercepted by catch-all
    // If we get here, the API route wasn't found - return 404
    res.status(404).json({ message: 'API endpoint not found' });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    const distPath = path.resolve(import.meta.dirname, "public");
    const indexPath = path.resolve(distPath, "index.html");

    if (!fs.existsSync(distPath)) {
      throw new Error(
        `Could not find the build directory: ${distPath}, make sure to build the client first`,
      );
    }

    // Cache the base HTML at startup so reads are cheap
    let baseHtml: string = fs.readFileSync(indexPath, "utf-8");

    // In production, intercept unknown SPA routes before the static catch-all
    // so crawlers receive a genuine HTTP 404 instead of a soft-404 200.
    app.use("*", (req, res, next) => {
      const pathname = req.originalUrl.split("?")[0];
      // Let actual static files through (JS, CSS, images, etc.)
      if (path.extname(pathname)) return next();
      // Let known SPA routes through to serve SEO-injected index.html with 200
      if (isKnownSpaRoute(pathname)) return next();
      // Unknown route: serve the React shell with HTTP 404 so the browser
      // shows the NotFound page while crawlers see the correct status.
      res.status(404).set({ "Content-Type": "text/html" }).send(
        injectSeoIntoHtml(baseHtml, pathname),
      );
    });

    // Serve static assets (JS, CSS, images, etc.)
    app.use(express.static(distPath));

    // For all remaining SPA HTML routes, inject route-specific SEO and send
    app.use("*", (req, res) => {
      const pathname = req.originalUrl.split("?")[0];
      res.status(200).set({ "Content-Type": "text/html" }).send(
        injectSeoIntoHtml(baseHtml, pathname),
      );
    });
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
