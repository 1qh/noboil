'use client'

import type { ComponentProps } from 'react'

import { cn } from '@a/ui'
import { Input } from '@a/ui/input'
import { Search } from 'lucide-react'

interface SearchInputProps extends Omit<ComponentProps<typeof Input>, 'onChange' | 'type' | 'value'> {
  iconClassName?: string
  inputClassName?: string
  onValueChange: (value: string) => void
  value: string
}

const SearchInput = ({ className, iconClassName, inputClassName, onValueChange, value, ...props }: SearchInputProps) => (
  <div className={cn('relative', className)}>
    <Search className={cn('absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground', iconClassName)} />
    <Input
      {...props}
      className={cn('pl-9', inputClassName)}
      onChange={e => onValueChange(e.target.value)}
      type='search'
      value={value}
    />
  </div>
)

export default SearchInput
