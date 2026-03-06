/**
 * saas-utils/error-handler
 * Standard API error handling for Next.js routes
 *
 * Usage:
 *   import { handleAPIError, createSuccessResponse } from 'saas-utils/error-handler'
 *
 *   try {
 *     const data = await doSomething()
 *     return createSuccessResponse(data)
 *   } catch (error) {
 *     return handleAPIError(error)
 *   }
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

/**
 * Standard API error response format
 */
export interface APIError {
  error: string
  message: string
  statusCode: number
  timestamp: string
}

type ErrorWithMeta = Error & {
  status?: number
  headers?: Record<string, string>
}

/**
 * Handles errors and returns formatted NextResponse
 */
export function handleAPIError(error: unknown): NextResponse<APIError> {
  const timestamp = new Date().toISOString()
  let status = 500
  const headers = new Headers()

  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation Error',
        message: error.issues.map(issue => issue.message).join(', '),
        statusCode: 400,
        timestamp,
      },
      { status: 400, headers }
    )
  }

  // Standard Error objects
  if (error instanceof Error) {
    const meta = error as ErrorWithMeta
    if (typeof meta.status === 'number') {
      status = meta.status
    }

    if (meta.headers && typeof meta.headers === 'object') {
      Object.entries(meta.headers).forEach(([key, value]) => {
        if (typeof value === 'string') headers.set(key, value)
      })
    }

    // Rate limit errors
    if (error.message.toLowerCase().includes('rate limit')) {
      const statusCode = status === 500 ? 429 : status
      return NextResponse.json(
        {
          error: 'Rate Limit Exceeded',
          message: error.message,
          statusCode,
          timestamp,
        },
        { status: statusCode, headers }
      )
    }

    const errorLabel =
      status >= 500
        ? 'Internal Server Error'
        : status >= 400
          ? 'Client Error'
          : 'Error'

    return NextResponse.json(
      {
        error: errorLabel,
        message: error.message,
        statusCode: status,
        timestamp,
      },
      { status, headers }
    )
  }

  // Unknown error type
  return NextResponse.json(
    {
      error: 'Unknown Error',
      message: 'An unexpected error occurred',
      statusCode: 500,
      timestamp,
    },
    { status: 500, headers }
  )
}

/**
 * Creates a success response with data
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse<T> {
  return NextResponse.json(data, { status })
}

/**
 * Creates an error with status code for handleAPIError
 */
export function createAPIError(message: string, status: number = 500): Error {
  const error = new Error(message) as ErrorWithMeta
  error.status = status
  return error
}
