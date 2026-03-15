import { expect, test } from './fixtures'

test.describe.serial('Chat & Streaming', () => {
  test('send message shows user row', async ({ chatPage, page, sessionListPage }) => {
    await sessionListPage.goto('/')
    await sessionListPage.getNewButton().click()
    await page.waitForURL(/\/chat\//)
    await chatPage.sendMessage('Hello agent')
    await expect(chatPage.getMessages().first()).toContainText('Hello agent')
  })

  test('chat log has role=log', async ({ chatPage, page, sessionListPage }) => {
    await sessionListPage.goto('/')
    await sessionListPage.getNewButton().click()
    await page.waitForURL(/\/chat\//)
    await expect(chatPage.getMessageLog()).toHaveAttribute('role', 'log')
  })

  test('empty chat shows placeholder', async ({ chatPage, page, sessionListPage }) => {
    await sessionListPage.goto('/')
    await sessionListPage.getNewButton().click()
    await page.waitForURL(/\/chat\//)
    await expect(page.getByText('No messages yet')).toBeVisible()
  })
})
