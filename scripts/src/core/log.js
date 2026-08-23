/**
 * Logging utilities with colors and levels
 */

const rawColors = {
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
}

function shouldUseColor(stream = process.stdout) {
  if ('NO_COLOR' in process.env) return false

  const forceColor = process.env.FORCE_COLOR
  if (forceColor !== undefined) {
    return !/^(0|false)$/i.test(String(forceColor))
  }

  return Boolean(stream?.isTTY)
}

const colors = shouldUseColor()
  ? rawColors
  : {
      dim: '',
      blue: '',
      red: '',
      green: '',
      yellow: '',
      reset: '',
    }

export function createLogger(level = 'info') {
  const levels = {debug: 0, info: 1, warn: 2, error: 3, silent: 4}
  const currentLevel = levels[level] ?? 1

  const log = (severity, msg) => {
    if (levels[severity] >= currentLevel) {
      const prefix = {
        debug: `${colors.dim}⊘${colors.reset}`,
        info: `${colors.blue}ℹ${colors.reset}`,
        warn: `${colors.yellow}⚠${colors.reset}`,
        error: `${colors.red}✗${colors.reset}`,
        success: `${colors.green}✓${colors.reset}`,
      }[severity]
      console.log(`${prefix} ${msg}`)
    }
  }

  const timers = {}

  return {
    debug: msg => log('debug', msg),
    info: msg => log('info', msg),
    warn: msg => log('warn', msg),
    error: msg => log('error', msg),
    success: msg => log('success', msg),
    time: label => {
      timers[label] = Date.now()
    },
    timeEnd: label => {
      const start = timers[label]
      if (start) {
        const elapsed = Date.now() - start
        log('debug', `${label} took ${elapsed}ms`)
        delete timers[label]
      }
    },
  }
}

export const colors_export = colors
