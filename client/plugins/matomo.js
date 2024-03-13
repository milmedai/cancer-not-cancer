import VueMatomo from 'vue-matomo'
import { defineNuxtPlugin } from 'nuxt/app'

// ['nuxt-matomo', { matomoUrl: hostUrl, siteId: 1, trackerUrl: scriptUrl, scriptUrl: scriptUrl, cookies: false }],

export default defineNuxtPlugin((nuxtApp) => {
    const config = useRuntimeConfig()
    const hostUrl = config.public.matomoUrl
    const scriptUrl = new URL('js/', hostUrl).href
    nuxtApp.vueApp.use(VueMatomo, {
        host: hostUrl,
        siteId: 1,
        trackerUrl: scriptUrl,
        trackerScriptUrl: scriptUrl,

        // Enables automatically registering pageviews on the router
        router: nuxtApp.$router,
        enableLinkTracking: false,
        disableCookies: true,

        // Other defaults
        // requireConsent: false,
        // trackInitialView: true,
        // requireCookieConsent: false,
    })
})