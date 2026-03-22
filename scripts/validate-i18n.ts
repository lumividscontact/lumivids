import { pt } from '../src/i18n/translations/pt'
import { en } from '../src/i18n/translations/en'
import { es } from '../src/i18n/translations/es'

type AnyRecord = Record<string, unknown>

type Report = {
  missing: string[]
  extra: string[]
  typeMismatches: string[]
}

const isObject = (value: unknown): value is AnyRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const compareTranslations = (base: AnyRecord, target: AnyRecord, prefix = ''): Report => {
  const missing: string[] = []
  const extra: string[] = []
  const typeMismatches: string[] = []

  Object.keys(base).forEach((key) => {
    const nextPath = prefix ? `${prefix}.${key}` : key
    if (!(key in target)) {
      missing.push(nextPath)
      return
    }

    const baseValue = base[key]
    const targetValue = target[key]

    if (isObject(baseValue)) {
      if (!isObject(targetValue)) {
        typeMismatches.push(nextPath)
        return
      }
      const child = compareTranslations(baseValue, targetValue, nextPath)
      missing.push(...child.missing)
      extra.push(...child.extra)
      typeMismatches.push(...child.typeMismatches)
      return
    }

    if (isObject(targetValue)) {
      typeMismatches.push(nextPath)
    }
  })

  Object.keys(target).forEach((key) => {
    const nextPath = prefix ? `${prefix}.${key}` : key
    if (!(key in base)) {
      extra.push(nextPath)
    }
  })

  return { missing, extra, typeMismatches }
}

const check = (name: string, base: AnyRecord, target: AnyRecord) => {
  const report = compareTranslations(base, target)

  if (report.missing.length > 0 || report.typeMismatches.length > 0) {
    console.error(`\n[i18n] ${name} is missing keys or has type mismatches:`)
    if (report.missing.length > 0) {
      console.error(`  Missing (${report.missing.length}):`)
      report.missing.forEach((key) => console.error(`   - ${key}`))
    }
    if (report.typeMismatches.length > 0) {
      console.error(`  Type mismatches (${report.typeMismatches.length}):`)
      report.typeMismatches.forEach((key) => console.error(`   - ${key}`))
    }
    process.exitCode = 1
  }

  if (report.extra.length > 0) {
    console.warn(`\n[i18n] ${name} has extra keys not in base:`)
    report.extra.forEach((key) => console.warn(`   - ${key}`))
  }
}

check('en', pt as AnyRecord, en as AnyRecord)
check('es', pt as AnyRecord, es as AnyRecord)

if (!process.exitCode) {
  console.log('[i18n] All translations match base keys.')
}
