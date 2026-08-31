import {describe, test} from 'node:test'
import assert from 'node:assert/strict'

import {createLogger} from '../../src/core/log.js'

describe('core/log', () => {
  test('creates a logger with the expected methods', () => {
    const logger = createLogger('info')
    assert.equal(typeof logger.info, 'function')
    assert.equal(typeof logger.warn, 'function')
    assert.equal(typeof logger.error, 'function')
    assert.equal(typeof logger.success, 'function')
    assert.equal(typeof logger.debug, 'function')
  })
})
