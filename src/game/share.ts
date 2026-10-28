// Links de convite e mensagens prontas para o WhatsApp.

/** Link universal da partida: convida quem não entrou e abre a partida para quem já joga. */
export const inviteLink = (code: string) => `${location.origin}/p/${code}`

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`
