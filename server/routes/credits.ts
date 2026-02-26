import { Router, Request, Response, NextFunction } from 'express';
import { creditService } from '../services/credit-service';
import type { User } from '../../shared/schema';
import { Client, Environment, OrdersController } from '@paypal/paypal-server-sdk';

// Simple auth middleware - will be replaced with proper middleware from parent
const requireAuth = (req: any, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Autenticação necessária' });
  }
  next();
};

const router = Router();

// Get available credit packages
router.get('/packages', async (req, res) => {
  try {
    const packages = await creditService.getAvailablePackages();
    res.json(packages);
  } catch (error) {
    console.error('Failed to fetch credit packages:', error);
    res.status(500).json({ message: 'Erro ao buscar pacotes de créditos' });
  }
});

// Create PayPal order for credit purchase
router.post('/purchase/create-order', requireAuth, async (req, res) => {
  try {
    const user = req.user as User;
    const { packageId } = req.body;

    if (!packageId) {
      return res.status(400).json({ message: 'ID do pacote é obrigatório' });
    }

    // Get package details
    const packages = await creditService.getAvailablePackages();
    const pkg = packages.find(p => p.id === packageId);

    if (!pkg) {
      return res.status(404).json({ message: 'Pacote não encontrado' });
    }

    const paypalClient = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: process.env.PAYPAL_CLIENT_ID!,
        oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!,
      },
      environment: process.env.NODE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
    });
    const paypalOrdersController = new OrdersController(paypalClient);

    const { body: orderBody } = await paypalOrdersController.createOrder({
      body: {
        intent: 'CAPTURE',
        purchaseUnits: [{
          amount: {
            currencyCode: 'USD',
            value: pkg.priceUsd,
          },
        }],
      },
      prefer: 'return=minimal',
    });

    const paypalOrder = JSON.parse(String(orderBody));

    if (!paypalOrder.id) {
      throw new Error('Failed to create PayPal order');
    }

    // Store order in database
    const order = await creditService.createCreditPurchaseOrder(
      user.id,
      packageId,
      paypalOrder.id,
      pkg.priceUsd,
      'USD'
    );

    res.json({
      orderId: paypalOrder.id,
      package: pkg,
      order: order,
    });
  } catch (error) {
    console.error('Failed to create credit purchase order:', error);
    res.status(500).json({ message: 'Erro ao criar ordem de compra' });
  }
});

router.post('/purchase/capture', requireAuth, async (req, res) => {
  try {
    const { orderID } = req.body;

    if (!orderID) {
      return res.status(400).json({ message: 'ID da ordem é obrigatório' });
    }

    const client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: process.env.PAYPAL_CLIENT_ID!,
        oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!,
      },
      environment: process.env.NODE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
    });
    const ordersController = new OrdersController(client);

    const { body, ...httpResponse } = await ordersController.captureOrder({
      id: orderID,
      prefer: 'return=minimal',
    });

    const captureData = JSON.parse(String(body));

    if (httpResponse.statusCode !== 201 && httpResponse.statusCode !== 200) {
      return res.status(400).json({
        message: 'Falha ao capturar pagamento',
        details: captureData,
      });
    }

    if (captureData.status !== 'COMPLETED') {
      return res.status(400).json({
        message: 'Pagamento não completado',
        status: captureData.status,
      });
    }

    const capture = captureData.purchase_units[0].payments.captures[0];
    const captureId = capture.id;
    const payerEmail = captureData.payer?.email_address;
    const payerId = captureData.payer?.payer_id;

    await creditService.captureAndCreditOrder(
      orderID,
      captureId,
      payerEmail,
      payerId
    );

    res.json({
      success: true,
      message: 'Créditos adicionados com sucesso!',
      captureId,
    });
  } catch (error) {
    console.error('Failed to capture payment:', error);
    const message = error instanceof Error ? error.message : 'Erro ao processar pagamento';
    res.status(500).json({ message });
  }
});

// Get all function costs (admin only)
router.get('/function-costs', requireAuth, async (req, res) => {
  try {
    const user = req.user as User;

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado: privilégios de admin necessários' });
    }

    const costs = await creditService.getAllFunctionCosts();
    res.json(costs);
  } catch (error) {
    console.error('Failed to fetch function costs:', error);
    res.status(500).json({ message: 'Erro ao buscar custos de funcionalidades' });
  }
});

// Update function cost (admin only)
router.put('/function-costs/:functionName', requireAuth, async (req, res) => {
  try {
    const user = req.user as User;

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado: privilégios de admin necessários' });
    }

    const { functionName } = req.params;
    const { costInCredits } = req.body;

    if (typeof costInCredits !== 'number' || costInCredits < 0) {
      return res.status(400).json({ message: 'Custo deve ser um número não negativo' });
    }

    await creditService.updateFunctionCost(functionName, costInCredits, user.id);

    res.json({
      success: true,
      message: 'Custo atualizado com sucesso',
      functionName,
      costInCredits,
    });
  } catch (error) {
    console.error('Failed to update function cost:', error);
    res.status(500).json({ message: 'Erro ao atualizar custo de funcionalidade' });
  }
});

export default router;
