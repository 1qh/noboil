'use node'

import type { ModelMessage } from 'ai'
import { streamText } from 'ai'
import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'

import { getModel } from '../ai'
import { ORCHESTRATOR_SYSTEM_PROMPT } from '../prompts'
import type { Doc, Id } from './_generated/dataModel'
import { internalAction } from './_generated/server'

const claimRunRef = makeFunctionReference<'mutation', { runToken: string; threadId: string }, { ok: boolean }>(
    'orchestrator:claimRun'
  ),
  finishRunRef = makeFunctionReference<'mutation', { runToken: string; threadId: string }, { scheduled: boolean }>(
    'orchestrator:finishRun'
  ),
  heartbeatRunRef = makeFunctionReference<'mutation', { runToken: string; threadId: string }, void>(
    'orchestrator:heartbeatRun'
  ),
  recordRunErrorRef = makeFunctionReference<'mutation', { error: string; threadId: string }, void>(
    'orchestrator:recordRunError'
  ),
  readRunStateRef = makeFunctionReference<'query', { threadId: string }, Doc<'threadRunState'> | null>(
    'orchestrator:readRunState'
  ),
  readSessionByThreadRef = makeFunctionReference<'query', { threadId: string }, Doc<'session'> | null>(
    'orchestrator:readSessionByThread'
  ),
  listMessagesForPromptRef = makeFunctionReference<
    'query',
    { promptMessageId?: string; threadId: string },
    Doc<'messages'>[]
  >('orchestrator:listMessagesForPrompt'),
  createAssistantMessageRef = makeFunctionReference<
    'mutation',
    { sessionId: Id<'session'>; threadId: string },
    Id<'messages'>
  >('orchestrator:createAssistantMessage'),
  patchStreamingMessageRef = makeFunctionReference<
    'mutation',
    { messageId: Id<'messages'>; streamingContent: string },
    void
  >('orchestrator:patchStreamingMessage'),
  appendStepMetadataRef = makeFunctionReference<'mutation', { messageId: Id<'messages'>; stepPayload: string }, void>(
    'orchestrator:appendStepMetadata'
  ),
  finalizeMessageRef = makeFunctionReference<
    'mutation',
    {
      content: string
      messageId: Id<'messages'>
      parts: Array<
        | { text: string; type: 'text' }
        | { text: string; type: 'reasoning' }
        | {
            args: string
            result?: string
            status: 'pending' | 'success' | 'error'
            toolCallId: string
            toolName: string
            type: 'tool-call'
          }
        | { snippet?: string; title: string; type: 'source'; url: string }
      >
    },
    void
  >('orchestrator:finalizeMessage'),
  postTurnAuditFencedRef = makeFunctionReference<
    'mutation',
    { runToken: string; threadId: string; turnRequestedInput: boolean },
    { ok: boolean; shouldContinue: boolean }
  >('orchestrator:postTurnAuditFenced')

const collectMessageText = (message: Doc<'messages'>) => {
  const parts = message.parts as Array<{ result?: string; status?: string; text?: string; title?: string; toolName?: string; type: string; url?: string }>
  if (parts.length === 0) return message.content
  const chunks: string[] = []
  for (const p of parts) {
    if (p.type === 'text' || p.type === 'reasoning') {
      chunks.push(p.text ?? '')
      continue
    }
    if (p.type === 'tool-call') {
      const resultText = p.result ? ` result=${p.result}` : ''
      chunks.push(`[tool:${p.toolName} status=${p.status}${resultText}]`)
      continue
    }
    chunks.push(`[source:${p.title} ${p.url}]`)
  }
  const joined = chunks.join('\n')
  return joined.length > 0 ? joined : message.content
}

const buildModelMessages = (messages: Doc<'messages'>[]) => {
  const modelMessages: ModelMessage[] = []
  for (const m of messages) {
    if (m.role !== 'assistant' && m.role !== 'system' && m.role !== 'user') continue
    modelMessages.push({ content: collectMessageText(m), role: m.role })
  }
  return modelMessages
}

const runOrchestrator = internalAction({
  args: { promptMessageId: v.optional(v.string()), runToken: v.string(), threadId: v.string() },
  handler: async (ctx, { promptMessageId, runToken, threadId }) => {
    const claimed = await ctx.runMutation(claimRunRef, { runToken, threadId })
    if (!claimed.ok) return
    const isStale = async () => {
      const state = await ctx.runQuery(readRunStateRef, { threadId })
      if (!state) return true
      if (state.status !== 'active') return true
      return state.activeRunToken !== runToken
    }
    const heartbeat = setInterval(() => {
      void ctx
        .runMutation(heartbeatRunRef, { runToken, threadId })
        .catch((_error: unknown) => {})
    }, 2 * 60 * 1000)
    try {
      if (await isStale()) return
      const session = await ctx.runQuery(readSessionByThreadRef, { threadId })
      if (!session || session.status === 'archived') return
      const dbMessages = await ctx.runQuery(listMessagesForPromptRef, {
        promptMessageId,
        threadId
      })
      const modelMessages = buildModelMessages(dbMessages)
      const messageId = await ctx.runMutation(createAssistantMessageRef, {
        sessionId: session._id,
        threadId
      })
      const model = await getModel(),
        result = streamText({
          messages: modelMessages,
          model,
          onStepFinish: async ({ text, toolCalls, toolResults, usage }) => {
            const stepPayload = JSON.stringify({ text, toolCalls, toolResults, usage })
            await ctx.runMutation(appendStepMetadataRef, {
              messageId,
              stepPayload
            })
          },
          system: ORCHESTRATOR_SYSTEM_PROMPT,
          temperature: 0.7,
          tools: {}
        })
      let fullText = '',
        flushAt = Date.now()
      for await (const delta of result.textStream) {
        fullText += delta
        const now = Date.now()
        if (now - flushAt < 400 && fullText.length % 200 !== 0) continue
        await ctx.runMutation(patchStreamingMessageRef, {
          messageId,
          streamingContent: fullText
        })
        flushAt = now
      }
      await ctx.runMutation(patchStreamingMessageRef, {
        messageId,
        streamingContent: fullText
      })
      const finalParts: Array<{ text: string; type: 'text' }> = [{ text: fullText, type: 'text' as const }]
      await ctx.runMutation(finalizeMessageRef, {
        content: fullText,
        messageId,
        parts: finalParts
      })
      if (await isStale()) return
      await ctx.runMutation(postTurnAuditFencedRef, {
        runToken,
        threadId,
        turnRequestedInput: false
      })
    } catch (error) {
      await ctx.runMutation(recordRunErrorRef, {
        error: String(error),
        threadId
      })
    } finally {
      clearInterval(heartbeat)
      await ctx.runMutation(finishRunRef, { runToken, threadId })
    }
  }
})

export { runOrchestrator }
