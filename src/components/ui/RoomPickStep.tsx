'use client'

type RoomPickItem = {
  id: string
  name: string
  roomUrl: string
  isDefault: boolean
  hasCookie: boolean
}

export default function RoomPickStep({
  rooms,
  selectedRoomId,
  onSelect,
  onConfirm,
  disabled,
}: {
  rooms: RoomPickItem[]
  selectedRoomId: string
  onSelect: (id: string) => void
  onConfirm: () => void
  disabled: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="text-left">
        <h2 className="text-h3">选择 BA 房间</h2>
        <p className="mt-2 text-14px text-fg3">请选择可运行此管线的房间，当前选择仅影响本次任务，不会改动全局默认房间。</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rooms.map((room) => {
          const active = room.id === selectedRoomId
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onSelect(room.id)}
              className={`surface-card flex flex-col items-start gap-3 p-5 text-left transition-colors ${
                active
                  ? 'border-[color:var(--color-brand-1)] bg-white/[0.06] shadow-[0_0_30px_rgba(13,109,255,0.35)]'
                  : 'hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-3">
                <p className="text-h4">{room.name}</p>
                <div className="flex items-center gap-2">
                  {room.isDefault ? <span className="chip bg-white/15 text-fg">默认房间</span> : null}
                  {active ? (
                    <span className="chip !bg-[rgba(13,109,255,0.2)] !text-[color:var(--color-brand-2)]">
                      已选中
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="break-all text-caption text-fg3">{room.roomUrl}</p>
              <p className={`text-caption ${room.hasCookie ? 'text-emerald-300' : 'text-amber-300'}`}>
                {room.hasCookie ? 'Cookie 已配置，可直接运行' : 'Cookie 未配置，运行前需先获取'}
              </p>
            </button>
          )
        })}
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onConfirm} disabled={!selectedRoomId || disabled} className="btn-gradient">
          确认房间
        </button>
      </div>
    </div>
  )
}
