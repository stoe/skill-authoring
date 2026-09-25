/**
 * Result reporters for different output formats
 */

import {colors_export as colors} from './log.js'

export function createReporter(format = 'pretty') {
  return (
    {
      pretty: prettyReporter,
      json: jsonReporter,
    }[format] || prettyReporter
  )
}

function prettyReporter(result) {
  const {skillName, errors, warnings, infos} = result

  console.log(`\nValidating skill at: ${skillName}\n`)

  // Success checks
  const successChecks = [
    'SKILL.md exists',
    'YAML frontmatter found',
    "Field 'name' present",
    "Field 'description' present",
    'SKILL.md length OK',
  ]

  successChecks.forEach(check => {
    console.log(`${colors.green}✓${colors.reset} ${check}`)
  })

  // Info messages
  infos.forEach(issue => {
    console.log(`${colors.blue}ℹ INFO:${colors.reset} ${issue.message}`)
  })

  // Errors
  errors.forEach(issue => {
    const code = issue.code ? `[${issue.code}] ` : ''
    console.log(`${colors.red}✗ ERROR:${colors.reset} ${code}${issue.message}`)
  })

  // Warnings
  warnings.forEach(issue => {
    const code = issue.code ? `[${issue.code}] ` : ''
    console.log(`${colors.yellow}⚠ WARNING:${colors.reset} ${code}${issue.message}`)
  })

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`${colors.green}✓ Validation passed!${colors.reset}`)
    return 0
  } else if (errors.length === 0) {
    console.log(`${colors.yellow}⚠ Validation passed with ${warnings.length} warning(s)${colors.reset}`)
    return 0
  } else {
    console.log(
      `${colors.red}✗ Validation failed with ${errors.length} error(s) and ${warnings.length} warning(s)${colors.reset}`,
    )
    return 1
  }
}

function jsonReporter(result) {
  const {errors, warnings, infos} = result
  const output = {
    errors: serializeIssues(errors),
    warnings: serializeIssues(warnings),
    infos: serializeIssues(infos),
    summary: {
      errorCount: errors.length,
      warningCount: warnings.length,
    },
  }
  console.log(JSON.stringify(output, null, 2))
  return errors.length > 0 ? 1 : 0
}

export function reportBatch(results, format = 'pretty', failLevel = 'error') {
  let totalErrors = 0
  let totalWarnings = 0

  results.forEach(result => {
    totalErrors += result.errors.length
    totalWarnings += result.warnings.length
  })

  if (format === 'json') {
    const output = {
      skills: results.map(r => ({
        name: r.skillName,
        errors: serializeIssues(r.errors),
        warnings: serializeIssues(r.warnings),
        errorCount: r.errors.length,
        warningCount: r.warnings.length,
      })),
      summary: {
        totalErrors,
        totalWarnings,
      },
    }
    console.log(JSON.stringify(output, null, 2))
  } else {
    console.log('\n' + '━'.repeat(40))
    if (totalErrors === 0 && totalWarnings === 0) {
      console.log(`${colors.green}✓ All validations passed!${colors.reset}`)
    } else if (totalErrors === 0) {
      console.log(`${colors.yellow}⚠ ${totalWarnings} warning(s) found${colors.reset}`)
    } else {
      console.log(`${colors.red}✗ ${totalErrors} error(s) and ${totalWarnings} warning(s) found${colors.reset}`)
    }
  }

  return totalErrors > 0 || (failLevel === 'warning' && totalWarnings > 0) ? 1 : 0
}

function serializeIssues(issues) {
  return issues.map(({code, message, path}) => ({code, message, path: path ?? null}))
}
