/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import Home from 'app/page'

describe('Home', () => {
    it('render is successful', () => {
        render(<Home />)

        const heading = screen.getByRole('main')

        expect(heading).toBeDefined()
    })
})
