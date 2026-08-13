const BUILTIN_PET_NAMES: Record<string, string> = {
  claude: 'Claude',
  gremlin: 'Gremlin',
  opencode: 'OpenCode',
  tide: 'Tide',
  pip: 'Pip',
  brick: 'Brick',
  ember: 'Ember',
  nori: 'Nori',
  bolt: 'Bolt',
  moss: 'Moss',
  cocoa: 'Cocoa',
  hex: 'Hex',
};

export function petDisplayName(
  characterId: string,
  customs: { id: string; name: string }[] = [],
): string {
  const custom = customs.find((item) => item.id === characterId);
  if (custom) return custom.name;
  return BUILTIN_PET_NAMES[characterId] ?? 'Your pet';
}
