import { useNavigate } from 'react-router-dom'
import { Share2, Users } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { useListsStore, visibleLists } from '../../store/useListsStore'
import { SubPage, Section, Row, useEnsureData } from './common'

export default function CollaborationPage() {
  useEnsureData()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const lists = useListsStore(s => s.lists)
  const membersMap = useListsStore(s => s.members)

  const visible = visibleLists(lists)
  const sharedWithMe = visible.filter(l => l.owner_id !== user?.id)
  const myShared = visible.filter(l => l.owner_id === user?.id && (membersMap[l.id] ?? []).length > 1)

  return (
    <SubPage title="Collaboration">
      <Section>
        <Row icon={<Users size={17} />} label="Shared with me"
          value={sharedWithMe.length > 0 ? `${sharedWithMe.length} ${sharedWithMe.length === 1 ? 'list' : 'lists'}` : 'None yet'}
          onPress={sharedWithMe.length > 0 ? () => navigate('/?filter=shared') : undefined} />
        <Row icon={<Share2 size={17} />} label="My shared lists"
          value={myShared.length > 0 ? `${myShared.length} ${myShared.length === 1 ? 'list' : 'lists'}` : 'None yet'} last />
      </Section>

      {/* My shared lists, tappable */}
      {myShared.length > 0 && (
        <Section title="Lists you share">
          {myShared.map((l, i) => (
            <Row
              key={l.id}
              icon={<span style={{ fontSize: 17 }}>{l.emoji}</span>}
              label={l.name}
              value={`${(membersMap[l.id] ?? []).length} members`}
              onPress={() => navigate(`/list/${l.id}`)}
              last={i === myShared.length - 1}
            />
          ))}
        </Section>
      )}

      <p className="text-sm text-muted" style={{ padding: '0 4px' }}>
        Joining a shared list happens through its invite link — ask the owner to share one with you.
      </p>
    </SubPage>
  )
}
