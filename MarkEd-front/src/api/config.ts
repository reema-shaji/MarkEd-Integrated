// To generate the api client types, run `npm run generate-api`

import { OpenAPI } from './index'

export const initializeApi = () => {
  OpenAPI.BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost'
  OpenAPI.WITH_CREDENTIALS = true
}
