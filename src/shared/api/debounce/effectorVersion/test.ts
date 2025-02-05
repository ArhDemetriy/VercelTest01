import { sinkMake_asyncRequest } from '../mock'
import { makeRCEffectDebounce as debounce } from './debounce'

describe('debounce init', () => {
    const tested = jest.fn(debounce)
    const mock = jest.fn(sinkMake_asyncRequest)
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

describe('debounce with sink make', () => {
    const mock = jest.fn(sinkMake_asyncRequest)
    afterEach(() => mock.mockClear())

    it('один запуск вызывает функцию 1 раз', () => {
        debounce(mock, { sid: 'test' }).run({})
        expect(mock.mock.calls.length).toBe(1)
    })
})
