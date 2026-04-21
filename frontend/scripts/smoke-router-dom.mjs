import React from 'react'

export function Link({ to, children, ...props }) {
  return React.createElement('a', { href: typeof to === 'string' ? to : '#', ...props }, children)
}

export function useLocation() {
  return { pathname: '/admin' }
}

export function useNavigate() {
  return () => {}
}