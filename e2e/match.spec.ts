import { expect, test, type Browser, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Gabarito só para os robôs escolherem a resposta; o app nunca o recebe.
const bank = JSON.parse(readFileSync(new URL('../server/questions.json', import.meta.url), 'utf8')) as { text: string; correctIndex: number }[]
const answerOf = new Map(bank.map((q) => [q.text, q.correctIndex]))

interface Bot {
  name: string
  page: Page
  /** Responder certo esta pergunta? */
  rightAnswer: (duel: boolean) => boolean
  /** Duelos que este jogador vai propor (quando houver personagem para disputar). */
  duels: number
  /** Qual personagem escolher: primeiro ou último da lista (para não ficarem iguais). */
  pick: 'first' | 'last'
  errors: string[]
  seen: Set<string>
}

async function player(browser: Browser, name: string, bot: Pick<Bot, 'rightAnswer' | 'duels' | 'pick'>): Promise<Bot> {
  const page = await (await browser.newContext()).newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return { name, page, errors, seen: new Set(), ...bot }
}

const visible = (page: Page, text: string | RegExp) => page.getByText(text).first().isVisible()

/**
 * Clica com prazo curto. Um destaque do rival (Realtime) pode cobrir o botão a
 * qualquer momento; aí o passo seguinte trata o destaque e tenta de novo.
 */
const tap = (target: Locator) => target.click({ timeout: 3000 }).then(() => true, () => false)

/** Anota os destaques na tela. Antes de cada clique: um destaque pode surgir no meio do passo. */
async function record(bot: Bot) {
  for (const t of ['Sua vez!', 'venceu o duelo!', 'conquistou']) if (await visible(bot.page, t)) bot.seen.add(t)
}

/** Faz a próxima ação possível na tela do jogador. false = nada a fazer (esperando o rival). */
async function step(bot: Bot): Promise<boolean> {
  const { page } = bot
  await record(bot)

  const question = page.getByTestId('question-text')
  if (await question.isVisible()) {
    const options = page.locator('ol button')
    if (await options.first().isEnabled()) {
      const correct = answerOf.get((await question.innerText()).trim())
      expect(correct, 'pergunta existe no banco').toBeDefined()
      const duel = await visible(page, /Duelo \d\/\d/)
      await tap(options.nth(bot.rightAnswer(duel) ? correct! : (correct! + 1) % 4))
      return true
    }
  }

  if (await page.getByRole('heading', { name: 'Escolha um personagem' }).isVisible()) {
    const challenge = page.getByRole('button', { name: /^Desafiar / })
    if (bot.duels > 0 && (await challenge.isVisible())) {
      if ((await tap(challenge)) && (await tap(page.getByRole('button', { name: 'Começar duelo' })))) bot.duels--
    } else {
      await tap(page.locator('ul.grid button')[bot.pick]())
    }
    return true
  }

  const labels = ['Jogar', 'Continuar', 'Girar de novo', 'Escolher personagem', 'Próxima pergunta', 'Ver resultado', 'Começar', 'Girar']
  for (const name of labels) {
    const button = page.getByRole('button', { name, exact: true })
    if ((await button.isVisible()) && (await button.isEnabled())) {
      await record(bot)
      await tap(button)
      return true
    }
  }
  return false
}

const ended = (bot: Bot) => visible(bot.page, 'é Mestre dos Negócios!')

test('dois jogadores: convite, partida completa com duelo e revanche', async ({ browser }) => {
  let biaHasCrown = false
  // Ana acerta tudo e desafia uma vez; Bia acerta até ganhar o 1º personagem e depois erra tudo.
  const ana = await player(browser, 'Ana', { rightAnswer: () => true, duels: 1, pick: 'first' })
  const bia = await player(browser, 'Bia', { rightAnswer: (duel) => !duel && !biaHasCrown, duels: 0, pick: 'last' })

  await ana.page.goto('/')
  await ana.page.getByPlaceholder('Seu nome').fill('Ana')
  await ana.page.getByRole('button', { name: 'Criar partida' }).click()
  await expect(ana.page.getByText('Convide um amigo')).toBeVisible()
  const code = (await ana.page.getByText(/^[A-Z0-9]{6}$/).innerText()).trim()

  await bia.page.goto(`/p/${code}`)
  await expect(bia.page.getByText('te desafiou!')).toBeVisible()
  await bia.page.getByPlaceholder('Seu nome').fill('Bia')
  await bia.page.getByRole('button', { name: 'Aceitar desafio' }).click()
  await expect(bia.page).toHaveURL(/\/m\//)
  await expect(ana.page.getByText('Bia aceitou o desafio!')).toBeVisible()
  await expect(ana.page.getByText('Convide um amigo')).toBeHidden()

  const deadline = Date.now() + 7 * 60_000
  while (!(await ended(ana)) || !(await ended(bia))) {
    expect(Date.now(), 'partida terminou a tempo').toBeLessThan(deadline)
    if (await visible(bia.page, 'Bia conquistou')) biaHasCrown = true
    const acted = (await step(ana)) || (await step(bia))
    if (!acted) await ana.page.waitForTimeout(300)
  }

  expect(ana.seen.has('Sua vez!') && bia.seen.has('Sua vez!'), 'os dois viram o resumo "Sua vez!"').toBe(true)
  expect(ana.seen.has('venceu o duelo!') && bia.seen.has('venceu o duelo!'), 'os dois viram o resultado do duelo').toBe(true)

  // Revanche: Bia pede; Ana vê o pedido pelo Realtime e aceita. Os dois caem na mesma partida.
  const oldUrl = bia.page.url()
  await bia.page.getByRole('button', { name: 'Revanche' }).click()
  await expect(bia.page).not.toHaveURL(oldUrl)
  await expect(ana.page.getByText('Bia quer revanche!')).toBeVisible()
  await ana.page.getByRole('button', { name: 'Aceitar revanche' }).click()
  await expect(ana.page).toHaveURL(bia.page.url())
  await expect(bia.page.getByRole('button', { name: 'Girar', exact: true })).toBeVisible()

  expect([...ana.errors, ...bia.errors], 'sem erros de JavaScript').toEqual([])
})
