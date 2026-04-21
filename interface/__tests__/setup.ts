import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Silence console.error in tests unless explicitly checking it
vi.spyOn(console, 'error').mockImplementation(() => {})
