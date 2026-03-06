/**
 * saas-utils/error-handler tests
 */

import { describe, it, expect, vi } from 'vitest'
import { ZodError, z } from 'zod'
import { handleAPIError, createSuccessResponse, createAPIError } from './index'

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({
      data,
      status: init?.status || 200,
      headers: init?.headers,
    })),
  },
}))

describe('Error Handler', () => {
  describe('handleAPIError', () => {
    it('should handle ZodError with 400 status', () => {
      const schema = z.object({ name: z.string() })
      let zodError: ZodError | null = null
      try {
        schema.parse({ name: 123 })
      } catch (e) {
        zodError = e as ZodError
      }

      const response = handleAPIError(zodError) as unknown as {
        data: { statusCode: number; error: string }
      }

      expect(response.data.statusCode).toBe(400)
      expect(response.data.error).toBe('Validation Error')
    })

    it('should handle standard Error with 500 status', () => {
      const error = new Error('Something went wrong')
      const response = handleAPIError(error) as unknown as {
        data: { statusCode: number; message: string }
      }

      expect(response.data.statusCode).toBe(500)
      expect(response.data.message).toBe('Something went wrong')
    })

    it('should handle Error with custom status', () => {
      const error = createAPIError('Not found', 404)
      const response = handleAPIError(error) as unknown as {
        data: { statusCode: number }
      }

      expect(response.data.statusCode).toBe(404)
    })

    it('should handle rate limit errors with 429 status', () => {
      const error = new Error('Rate limit exceeded')
      const response = handleAPIError(error) as unknown as {
        data: { statusCode: number; error: string }
      }

      expect(response.data.statusCode).toBe(429)
      expect(response.data.error).toBe('Rate Limit Exceeded')
    })

    it('should handle unknown error types', () => {
      const response = handleAPIError('string error') as unknown as {
        data: { statusCode: number; error: string }
      }

      expect(response.data.statusCode).toBe(500)
      expect(response.data.error).toBe('Unknown Error')
    })

    it('should include timestamp in response', () => {
      const error = new Error('Test')
      const response = handleAPIError(error) as unknown as {
        data: { timestamp: string }
      }

      expect(response.data.timestamp).toBeDefined()
      expect(new Date(response.data.timestamp).getTime()).not.toBeNaN()
    })
  })

  describe('createSuccessResponse', () => {
    it('should create response with default 200 status', () => {
      const response = createSuccessResponse({ message: 'ok' }) as unknown as {
        data: { message: string }
        status: number
      }

      expect(response.status).toBe(200)
      expect(response.data.message).toBe('ok')
    })

    it('should create response with custom status', () => {
      const response = createSuccessResponse({ id: 1 }, 201) as unknown as {
        status: number
      }

      expect(response.status).toBe(201)
    })

    it('should preserve data types', () => {
      const data = {
        id: 123,
        items: ['a', 'b'],
        nested: { key: 'value' },
      }
      const response = createSuccessResponse(data) as unknown as {
        data: typeof data
      }

      expect(response.data).toEqual(data)
    })
  })

  describe('createAPIError', () => {
    it('should create error with message and status', () => {
      const error = createAPIError('Custom error', 403)

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Custom error')
      expect((error as Error & { status: number }).status).toBe(403)
    })

    it('should default to 500 status', () => {
      const error = createAPIError('Server error')

      expect((error as Error & { status: number }).status).toBe(500)
    })
  })
})
