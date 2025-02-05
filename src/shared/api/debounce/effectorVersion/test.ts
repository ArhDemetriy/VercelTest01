import { getDelay } from '@/shared/utils/delay'
import { makeRequest } from '../mock'
import { makeRCEffectDebounce as debounce } from './debounce'

describe('debounce init', () => {
    const tested = jest.fn(debounce)
    const mock = jest.fn(makeRequest)
    afterEach(() => {
        tested.mockClear()
        mock.mockClear()
    })

    it('toBe', () => expect(debounce).toBeDefined())

    it('not run cb on init', () => {
        tested(mock, { sid: 'test' })
        expect(tested.mock.calls.length).toBe(1)
        expect(mock.mock.calls.length).toBe(0)
    })

    it('export "run" method', () => {
        expect(tested(mock, { sid: 'test' })?.run).toBeDefined()
    })
})

describe('debounce run', () => {
    const mock = jest.fn(makeRequest)
    afterEach(() => {
        mock.mockClear()
    })

    it('call cb once after once call "run" method ', () => {
        debounce(mock, { sid: 'test' }).run({ payload: { page: 2 } })
        expect(mock.mock.calls.length).toBe(1)
    })
    it('call cb many fast after once call "run" method ', async () => {
        const { run } = debounce(mock, { sid: 'test', debounce: 200 })
        run({ payload: { page: 1 } })
        await getDelay(50)
        run({ payload: { page: 2 } })
        await getDelay(50)
        run({ payload: { page: 3 } })
        await getDelay(1000)
        expect(mock.mock.calls.length).toBe(1)
        expect(mock.mock.calls.map(([{ page }]) => page)).toEqual([1, 3])
    })
})
