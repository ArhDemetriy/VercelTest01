export const getDelay = async <T>(delay: number = 0, data?: T) =>
    new Promise<T>(resolve => {
        setTimeout(resolve, delay, data)
    })

export const getPromise = async <T>(data?: T) => Promise.resolve(data)
