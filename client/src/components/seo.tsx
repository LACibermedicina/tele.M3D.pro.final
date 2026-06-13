import { useEffect } from "react";

const SITE_NAME = "Tele<M3D>";
const DEFAULT_IMAGE = "/favicon-512x512.png";
const FALLBACK_ORIGIN = "https://tele.m3d.pro";

function getOrigin(): string {
  return typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : FALLBACK_ORIGIN;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function upsertJsonLd(id: string, data: unknown) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function removeJsonLd(id: string) {
  document.getElementById(id)?.remove();
}

export interface SeoOptions {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: string;
  noIndex?: boolean;
}

export function useSeo({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  type = "website",
  noIndex = false,
}: SeoOptions) {
  useEffect(() => {
    const origin = getOrigin();
    const url = origin + path;
    const imageUrl = image.startsWith("http") ? image : origin + image;

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", noIndex ? "noindex, nofollow" : "index, follow");
    upsertLink("canonical", url);

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:image", imageUrl);
    upsertMeta("property", "og:site_name", SITE_NAME);

    upsertMeta("name", "twitter:card", "summary");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", imageUrl);
  }, [title, description, path, image, type, noIndex]);
}

export const PAGE_SEO = {
  home: {
    title: "Tele<M3D> - Telemedicina com IA | Consultas, Agenda e Prontuário",
    description:
      "Plataforma completa de telemedicina com IA: videoconsultas, triagem inteligente, agendamento, prescrições digitais e prontuário eletrônico seguro.",
    path: "/",
  },
  features: {
    title: "Funcionalidades - Tele<M3D>",
    description:
      "Conheça os recursos do Tele<M3D>: videoconsultas com IA, triagem por Protocolo de Manchester, agenda, prescrições, prontuário eletrônico e relatórios clínicos.",
    path: "/features",
  },
  documentation: {
    title: "Documentação - Tele<M3D>",
    description:
      "Documentação técnica e guias do Tele<M3D> para médicos, pacientes e administradores: configuração, fluxos de consulta e integração de recursos.",
    path: "/documentation",
  },
  manual: {
    title: "Manual do Usuário - Tele<M3D>",
    description:
      "Manual passo a passo do Tele<M3D>: como criar conta, iniciar teleconsultas, gerenciar agenda, emitir prescrições e usar a assistência por IA.",
    path: "/manual",
  },
  faq: {
    title: "Perguntas Frequentes (FAQ) - Tele<M3D>",
    description:
      "Respostas para as dúvidas mais comuns sobre o Tele<M3D>: contas, teleconsultas, câmera e microfone, acesso por QR Code, prescrições e diretrizes de IA.",
    path: "/faq",
  },
  login: {
    title: "Entrar - Tele<M3D>",
    description:
      "Acesse sua conta Tele<M3D> para gerenciar teleconsultas, agenda, prescrições e prontuários com segurança.",
    path: "/login",
  },
  register: {
    title: "Criar Conta - Tele<M3D>",
    description:
      "Crie sua conta no Tele<M3D> como médico, paciente, administrador ou farmacêutico e comece a usar a plataforma de telemedicina com IA.",
    path: "/register",
  },
  registerPatient: {
    title: "Cadastro de Paciente - Tele<M3D>",
    description:
      "Crie sua conta de paciente no Tele<M3D> para agendar teleconsultas, acessar prescrições e acompanhar seu prontuário.",
    path: "/register/patient",
  },
  registerDoctor: {
    title: "Cadastro de Médico - Tele<M3D>",
    description:
      "Crie sua conta de médico no Tele<M3D> para realizar teleconsultas, gerenciar agenda, emitir prescrições e usar a assistência por IA.",
    path: "/register/doctor",
  },
  registerAdmin: {
    title: "Cadastro de Administrador - Tele<M3D>",
    description:
      "Crie sua conta de administrador no Tele<M3D> para gerenciar usuários, configurações da clínica e operações da plataforma.",
    path: "/register/admin",
  },
  registerPharmacist: {
    title: "Cadastro de Farmacêutico - Tele<M3D>",
    description:
      "Crie sua conta de farmacêutico no Tele<M3D> para verificar prescrições e gerenciar a dispensação de medicamentos.",
    path: "/register/pharmacist",
  },
  acesso: {
    title: "Acesso à Consulta - Tele<M3D>",
    description: "Entre na sala de espera da sua teleconsulta usando o código de acesso ou QR Code.",
    path: "/acesso",
    noIndex: true,
  },
  join: {
    title: "Entrar na Consulta - Tele<M3D>",
    description: "Acesse sua teleconsulta através do link recebido.",
    path: "/join",
    noIndex: true,
  },
  immediateConsultation: {
    title: "Sala de Espera — Consulta Imediata - Tele<M3D>",
    description: "Sala de espera virtual para consulta imediata. Acesso por link de atendimento.",
    path: "/immediate-consultation",
    noIndex: true,
  },
} satisfies Record<string, SeoOptions>;

export function Seo({ page }: { page: keyof typeof PAGE_SEO }) {
  useSeo(PAGE_SEO[page]);
  return null;
}
