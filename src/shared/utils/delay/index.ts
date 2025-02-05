export const getDelay = async <T>(delay: number = 0, data?: T) =>
    new Promise<T>(resolve => {
        setTimeout(resolve, delay, data)
    })
