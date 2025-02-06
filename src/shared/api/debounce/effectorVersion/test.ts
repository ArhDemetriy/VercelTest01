import { getDelay } from '@/shared/utils/delay'
import { sinkMake_asyncRequest, sinkMake_promiseRequest } from '../mock'
import { makeRCEffectDebounce as debounce } from './debounce'
import { UnitValue, createStore, sample } from 'effector'

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
})

describe('debounce returns', () => {
    const tested = debounce
    const mock = sinkMake_asyncRequest

    it('export "run" method', () => expect(tested(mock, { sid: 'test' })?.run).toBeDefined())
    it('export loadingList', () =>
        expect(tested(mock, { sid: 'test' })?.$loadingList).toBeDefined())
    it('export agregate all loading', () =>
        expect(tested(mock, { sid: 'test' })?.$isLoading).toBeDefined())
    it('export data', () => expect(tested(mock, { sid: 'test' })?.doneData).toBeDefined())

    it('return correct data in next macrotask after running', async () => {
        const data = 'data'
        const { run, doneData } = tested(mock<typeof data>, { sid: 'test' })
        const result = sample({
            clock: doneData,
            target: createStore<UnitValue<typeof doneData> | null>(null, { sid: 'result' }),
        })
        run({ payload: { data } })

        await getDelay()
        expect(result.getState()?.data).toBe(data)
        await getDelay(100)
        expect(result.getState()?.data).toBe(data)
    })
    describe('return correct data in next macrotask after running', () => {
        it('для множественных вызовов, возвращает рузультат последнего вызова', async () => {
            const data1: string = 'data1'
            const data2: typeof data1 = 'data2'
            const data3: typeof data1 = 'data3'
            const { run, doneData } = tested(mock<typeof data1>, { sid: 'test' })
            const result = sample({
                clock: doneData,
                target: createStore<UnitValue<typeof doneData> | null>(null, { sid: 'result' }),
            })
            run({ payload: { data: data1 } })
            run({ payload: { data: data2 } })
            run({ payload: { data: data3 } })

            await getDelay()
            expect(result.getState()?.data).toBe(data3)
            await getDelay(100)
            expect(result.getState()?.data).toBe(data3)
        })
        it('для множественных вызовов, разнесённых во времени, возвращает рузультат последнего вызова', async () => {
            const data1: string = 'data1'
            const data2: typeof data1 = 'data2'
            const data3: typeof data1 = 'data3'
            const { run, doneData } = tested(mock<typeof data1>, { sid: 'test' })
            const result = sample({
                clock: doneData,
                target: createStore<UnitValue<typeof doneData> | null>(null, { sid: 'result' }),
            })
            run({ payload: { data: data1 } })
            await getDelay(100)
            run({ payload: { data: data2 } })
            await getDelay(50)
            run({ payload: { data: data3 } })

            await getDelay()
            expect(result.getState()?.data).toBe(data3)
            await getDelay(100)
            expect(result.getState()?.data).toBe(data3)
        })
    })
})

describe('debounce with sink make', () => {
    const tested = debounce
    const mock = jest.fn(sinkMake_asyncRequest)
    afterEach(() => mock.mockClear())

    it('один запуск вызывает функцию 1 раз', () => {
        tested(mock, { sid: 'test' }).run({})
        expect(mock.mock.calls.length).toBe(1)
    })

    const runTestCalling = (maxCount: number) =>
        describe.skip(`${maxCount} синхронных попыток вызвать запрос`, () => {
            it('Должны триггерить срабатывание только одного вызова.', () => {
                const { run } = tested(mock, { sid: 'test' })
                for (let i = 0; i < maxCount; i++) run({ payload: { delayResponse: 0 } })
                expect(mock.mock.calls.length).toBe(1)
            })
            describe('Должны триггерить срабатывание только одного вызова.', () => {
                it('Даже если ответ приходит в рамках текущего макротаска.', () => {
                    const mock = jest.fn(sinkMake_promiseRequest)
                    const { run } = tested(mock, { sid: 'test' })
                    for (let i = 0; i < maxCount; i++) run({})
                    expect(mock.mock.calls.length).toBe(1)
                })
                it('Даже если ответ приходит с задержкой.', () => {
                    const { run } = tested(mock, { sid: 'test' })
                    for (let i = 0; i < maxCount; i++) run({ payload: { delayResponse: 100 } })
                    expect(mock.mock.calls.length).toBe(1)
                })
            })
        })
    runTestCalling(1)
    runTestCalling(2)
    runTestCalling(3)
    runTestCalling(300)

    const runTestReturns = (maxCount: number) => {
        describe(`${maxCount} синхронных попыток вызвать запрос`, () => {
            it('Должны триггерить срабатывание только одного вызова.', () => {
                const { run } = debounce(mock, { sid: 'test' })
                for (let i = 0; i < maxCount; i++) run({ payload: { delayResponse: 0 } })
                expect(mock.mock.calls.length).toBe(1)
            })
            describe('Должны триггерить срабатывание только одного вызова.', () => {
                it('Даже если ответ приходит в рамках текущего макротаска.', () => {
                    const mock = jest.fn(sinkMake_promiseRequest)
                    const { run } = debounce(mock, { sid: 'test' })
                    for (let i = 0; i < maxCount; i++) run({})
                    expect(mock.mock.calls.length).toBe(1)
                })
                it('Даже если ответ приходит с задержкой.', () => {
                    const { run } = debounce(mock, { sid: 'test' })
                    for (let i = 0; i < maxCount; i++) run({ payload: { delayResponse: 100 } })
                    expect(mock.mock.calls.length).toBe(1)
                })
            })
        })
    }
})
