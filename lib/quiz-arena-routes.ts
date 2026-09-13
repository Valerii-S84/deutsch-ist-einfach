export const apiRoutes = {
  public: {
    stats: "/stats",
  },
  admin: {
    overview: "/admin/overview",
    economy: {
      purchases: "/admin/economy/purchases",
      subscriptions: "/admin/economy/subscriptions",
      cohorts: "/admin/economy/cohorts",
    },
    users: "/admin/users",
    promo: {
      list: "/admin/promo",
      detail: (promoId: number | string) => `/admin/promo/${promoId}`,
      stats: (promoId: number | string) => `/admin/promo/${promoId}/stats`,
      audit: (promoId: number | string) => `/admin/promo/${promoId}/audit`,
      products: "/admin/promo/products",
      checkCode: "/admin/promo/check-code",
      bulkGenerate: "/admin/promo/bulk-generate",
      toggle: (promoId: number | string) => `/admin/promo/${promoId}/toggle`,
      revoke: (promoId: number | string) => `/admin/promo/${promoId}/revoke`,
    },
    auth: {
      login: "/admin/auth/login",
      verify2FA: "/admin/auth/2fa/verify",
      session: "/admin/auth/session",
      logout: "/admin/auth/logout",
    },
    content: "/admin/content",
    system: "/admin/system",
  },
} as const;
