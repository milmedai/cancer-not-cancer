const base = new URL(process.env.PUBLIC_PATH).pathname
export default {
  globalName: 'pathapp',
  // Target: https://go.nuxtjs.dev/config-target
  target: 'static',
  telemetry: false,

  publicRuntimeConfig: {
    uploadSizeLimit: process.env.UPLOAD_SIZE_LIMIT,
    url: {
      // TODO: REMOVE, not needed
      // base: process.env.DOMAIN,
      // api: process.env.API_URL,
      // client: `${process.env.PROTOCOL}://${process.env.SUB_DOMAIN_CLIENT}${process.env.DOMAIN}`
    }
  },
  privateRuntimeConfig: {},

  // Global page headers: https://go.nuxtjs.dev/config-head
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
      { rel:'icon', type:'image/png', sizes:'32x32', href: base + 'favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: base + 'favicon-16x16.png' },
      { rel: 'manifest', href: base + 'site.webmanifest' }
    ]
  },

  watchers: {
    webpack: {
      // Don't watch node_modules (idk why this isn't default)
      ignored: /node_modules/
    }
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [
    '~assets/css/main.css'
  ],

  // Automatically restart the whole server when main.css changes
  watch: [
    '~assets/css/main.css'
  ],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
  ],

  // Auto import components: https://go.nuxtjs.dev/config-components
  // Under `/components`
  components: true,

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    '@nuxtjs/style-resources'
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    '@nuxtjs/axios',
  ],
  axios: {
    baseURL: process.env.API_URL, // api URL
    credentials: true,
    https: (process.env.PROTOCOL == 'https'),
    debug: false,
  },

  // Globally accessible style resources
  // e.g. variables declared in scss files here are globally available
  styleResources: {
    scss: [
      './assets/scss/colors.scss',
      './assets/scss/variables.scss'
    ]
  },

  // TODO: can we use this to pre-authenticate users?
  // Note: Why would we want to pre-authenticate users? Seems like it could be a security risk.
  // // Customization for vue-router: https://nuxtjs.org/docs/configuration-glossary/configuration-router
  router: {
    base: new URL(process.env.PUBLIC_PATH).pathname,
    // Middleware runs on every page
    // middleware: [
    //   'isLoggedIn',
    //   'authError'
    // ]
  },
  
  // Server side rendering :: removes the server
  // Must be false for axios requests in middleware
  ssr: false,

  // Build Configuration: https://go.nuxtjs.dev/config-build
  // publicPath: when specified, creates absolute links.
  //   ex. publicPath: 'https://my.app.com'
  //   would change /about to https://my.app.com/about
  //   This is needed for CDNs
  build: {
    publicPath: process.env.PUBLIC_PATH, // create absolute links
    devtools: false,
  }
}