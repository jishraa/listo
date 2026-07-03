export type ListType = 'personal' | 'tasks' | 'shopping'

export interface ListMember {
  id: string
  list_id: string
  user_id: string | null
  role: 'owner' | 'collaborator'
  display_name: string
}

export interface ListItem {
  id: string
  list_id: string
  title: string
  quantity: string | null
  completed: boolean
  added_by_name: string
  completed_by_name: string | null
  completed_at: string | null
  category: string | null
  sort_order: number
  created_at: string
}

export interface List {
  id: string
  name: string
  type: ListType
  emoji: string
  owner_id: string
  invite_code: string
  invite_expires_at: string | null
  is_template: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}
