import { defineNuxtConfig } from "nuxt/config"

/**
 * Catch base pathname to add to relative domains. This is allows staging to
 * work at the same url as production.
 */
const base = new URL(process.env.PUBLIC_PATH).pathname
const matomoNoscriptUrl = new URL('js/', process.env.ANALYTICS_URL)
matomoNoscriptUrl.searchParams.set('idsite', 1)
matomoNoscriptUrl.searchParams.set('rec', 1)

export default defineNuxtConfig({
  /** 
   * Note: You can no longer change the global context __NUXT__ as in Nuxt2.
   * Some work arounds can be found here: https://github.com/nuxt/nuxt/issues/18870
   */
  app: {
    rootId: 'pathapp',
    baseURL: base,
    buildAssetsDir: 'cncclient/',
    /**
     * SEO Meta info in the head: https://nuxt.com/docs/getting-started/seo-meta
     */
    head: {
      title: 'Cancer Not Cancer',
      htmlAttrs: {
        lang: 'en'
      },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { hid: 'description', name: 'description', content: '' },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'msapplication-TileColor', content: '#5d6770' },
        { name: 'theme-color', content: '#5d6770' }
      ],
      link: [
        // Favicon
        { rel: 'icon', type: 'image/svg+xml', href: base + 'logo.svg' },
        { rel: 'mask-icon', href: base + 'safari-pinned-tab.svg', color: '#9f262c' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: base + 'apple-touch-icon.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: base + 'favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: base + 'favicon-16x16.png' },
        { rel: 'manifest', href: base + 'site.webmanifest' }
      ],
      /**
       * The noscript is setup for matomo. Nuxt2's __dangerouslyDisableSanitizers doesn't exist anymore.
       */
      noscript: [{
        innerHTML: `<img src="${matomoNoscriptUrl.href}" style="border: 0" alt="" />`
      }],
    },
  },

  /**
   * Runtime Config: https://nuxt.com/docs/guide/going-further/runtime-config
   */
  runtimeConfig: {
    // private config here
    
    public: {
      uploadSizeLimit: process.env.UPLOAD_SIZE_LIMIT,
      apiUrl: process.env.API_URL,
      matomoUrl: process.env.ANALYTICS_URL,
    }
  },

  /**
   * Central SASS/SCSS/CSS setup. The css config in vite allows the usage of the variables and colors
   * throughout the application.
   */
  css: ["@/assets/scss/main.scss", "@fortawesome/fontawesome-svg-core/styles.css"],
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@import "@/assets/scss/variables.scss"; @import "@/assets/scss/colors.scss";',
        }
      },
    }
  },

  /** 
   * Plugins: https://nuxt.com/docs/guide/directory-structure/plugins
   * Plugins are loaded during application creation and are usable throughout the app.
   * Note: Ad blockers may breaking the site because of matomo.
   */
  plugins: [
    '~/plugins/error-handler.js',
    '~/plugins/draggable.js',
    ...(process.env.NODE_ENV === 'production' ? [{ src: '~/plugins/matomo.js', mode: 'client' }] : []),
  ],

  /**
   * Auto import components: https://nuxt.com/docs/guide/directory-structure/components#component-names
   * Allows component usage like Nuxt2.
   */ 
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    }
  ],

  /** 
   * Modules: https://nuxt.com/docs/guide/concepts/modules
   * Pinia Store: https://pinia.vuejs.org/ssr/nuxt.html
   */
  modules: [
    '@pinia/nuxt',
  ],
  
  /**
   * Server side rendering: set to false because this site is served statically.
   */
  ssr: false,

  /**
   * Sourcemap and devtools are on by default in dev mode. To use them in
   * staging or production you should uncomment them.
   */
  // sourcemap: true,
  devtools: { enabled: false }
  // debug: true

})