/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
