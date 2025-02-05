import { makeRequest } from '../mock'
import { debounce } from './debounce'

describe('debounce init', () => {
    const tested = jest.fn(debounce)
    const mock = jest.fn(makeRequest)
    afterEach(() => {
        tested.mockClear()
        mock.mockClear()
    })

    it('should toBe', () => expect(debounce).toBeDefined())

    it('not run cb on init', () => {
        tested(mock)
        expect(tested.mock.calls.length).toBe(1)
        expect(mock.mock.calls.length).toBe(0)
    })
})
