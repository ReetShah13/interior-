import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs'
import { StatusCodes } from 'http-status-codes'
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai'

import { checkApiLimit, increaseApiLimit } from '@/lib/api-limit'
import { checkSubscription } from '@/lib/subscription'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})

const openai = new OpenAIApi(configuration)

export async function POST(req: Request) {
  try {
    const { userId } = auth()

    if (!userId) {
      return new NextResponse('Unauthorized', {
        status: StatusCodes.UNAUTHORIZED
      })
    }

    if (!configuration.apiKey) {
      return new NextResponse('OpenAI API Key not configured', {
        status: StatusCodes.INTERNAL_SERVER_ERROR
      })
    }

    const body = await req.json()
    const messages = body.messages as ChatCompletionRequestMessage[]

    if (!messages) {
      return new NextResponse('Messages are required', {
        status: StatusCodes.BAD_REQUEST
      })
    }

    const freeTrial = await checkApiLimit()
    const isPro = await checkSubscription()

    if (!freeTrial && !isPro) {
      return new NextResponse('Free trial has expired.', {
        status: StatusCodes.PAYMENT_REQUIRED
      })
    }

    const { data } = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages
    })

    if (!isPro) await increaseApiLimit()

    return NextResponse.json(data.choices[0].message, {
      status: StatusCodes.CREATED
    })
  } catch (error) {
    console.log('[CONVERSATION_ERROR]', error)
    return new NextResponse('Internal error', {
      status: StatusCodes.INTERNAL_SERVER_ERROR
    })
  }
}
