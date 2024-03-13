// For Nuxt 3 - https://fontawesome.com/docs/web/use-with/vue/use-with#nuxt
import { library, config } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faTag, faTags, faPencil, faQuestion, faTrashCan, faXmark, faDownload, faB, faItalic, faU, faListUl, faListOl, faAngleDown, faStrikethrough, faCode, faRemoveFormat, faQuoteLeft, faImage } from '@fortawesome/free-solid-svg-icons'
import { faPenToSquare, faTrashCan as farTrashCan } from '@fortawesome/free-regular-svg-icons'

// This is important, we are going to let Nuxt worry about the CSS
config.autoAddCss = false

// https://fontawesome.com/docs/web/use-with/vue/add-icons#set-up-the-library
// You can add your icons directly in this plugin. See other examples for how you
// can add other styles or just individual icons.
library.add(faTag, faTags, faPencil, faQuestion, faTrashCan, faXmark, faDownload, faPenToSquare, farTrashCan, faB, faItalic, faU, faListUl, faListOl, faAngleDown, faStrikethrough, faCode, faRemoveFormat, faQuoteLeft, faImage)

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.component('fa-icon', FontAwesomeIcon, {})
})