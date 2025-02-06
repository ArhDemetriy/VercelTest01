import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
    baseDirectory: __dirname,
    // recommendedConfig: {
    // },
})

const eslintConfig = [
    ...compat.config({
        extends: ['next/core-web-vitals', 'next/typescript', 'prettier'],
        rules: {
            '@typescript-eslint/no-empty-interface': 1,
            '@typescript-eslint/no-empty-function': 1,
            '@typescript-eslint/no-unused-vars': 1,
            '@typescript-eslint/no-inferrable-types': 1,
            '@typescript-eslint/ban-ts-comment': 1,
            '@typescript-eslint/ban-types': 1,

            'no-empty-function': 1,
            'no-empty': 1,
            'no-else-return': 1,
            'func-style': [1, 'declaration', { allowArrowFunctions: true }],
            curly: [1, 'multi-line'],
            'prefer-const': 1,
        },
    }),
]
export default eslintConfig
