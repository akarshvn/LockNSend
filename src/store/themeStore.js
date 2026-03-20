import { create } from 'zustand'

const useThemeStore = create((set) => ({
  theme: localStorage.getItem('locknsend_theme') || 'amoled',

  setTheme: (theme) => {
    localStorage.setItem('locknsend_theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
  },

  initTheme: () => {
    const savedTheme = localStorage.getItem('locknsend_theme') || 'amoled'
    document.documentElement.setAttribute('data-theme', savedTheme)
  }
}))

export default useThemeStore
