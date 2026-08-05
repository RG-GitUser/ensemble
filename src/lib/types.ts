export type Plan = "basic" | "pro" | "enterprise";
export type SetupPath = "scratch" | "integrate";

export interface User {
  id: number;
  email: string;
  name: string;
  businessName: string;
  createdAt: string;
}

export interface SiteConfig {
  themeColor: string;
  tagline: string;
  stripeKey?: string;
  calendlyUrl?: string;
  chatroomEnabled?: boolean;
  newsletterEnabled?: boolean;
}

export interface Site {
  id: number;
  userId: number;
  slug: string;
  plan: Plan;
  published: boolean;
  config: SiteConfig;
  createdAt: string;
}

export interface Section {
  id: number;
  siteId: number;
  type: string;
  position: number;
  content: Record<string, string>;
}

export interface QuoteRequest {
  id: number;
  userId: number;
  name: string;
  businessName: string;
  email: string;
  websiteUrl: string;
  details: string;
  status: "new" | "quoted" | "closed";
  createdAt: string;
}

export interface Lead {
  id: number;
  siteId: number;
  email: string;
  createdAt: string;
}
