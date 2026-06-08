import { Platform, StyleSheet } from 'react-native';
import { COLORS, SIZES, SPACING, TYPOGRAPHY, SHADOWS } from '../theme';

const IS_WEB = Platform.OS === 'web';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenScroll: {
    flex: 1,
  },
  screenContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xxxl,
  },
  screenStack: {
    rowGap: SPACING.xl,
    width: '100%',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  glowTopLeft: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(16,185,129,0.12)',
    top: -80,
    left: -40,
  },
  glowBottomRight: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(168,85,247,0.12)',
    bottom: -120,
    right: -60,
  },
  glassCard: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusXl,
    padding: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  authCard: {
    width: '100%',
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  brandTitle: {
    ...TYPOGRAPHY.hero,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: SPACING.xs,
    textTransform: 'uppercase',
  },
  brandSubtitle: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.primary,
    textAlign: 'center',
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  formStack: {
    width: '100%',
    rowGap: SPACING.md,
  },
  helperText: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  fieldLabel: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textSoft,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  input: {
    height: SIZES.inputHeight,
    borderRadius: SIZES.radiusMd,
    backgroundColor: 'rgba(5,5,8,0.6)',
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    color: COLORS.text,
    ...TYPOGRAPHY.body,
  },
  inputWarning: {
    borderColor: COLORS.warning,
  },
  readOnlyInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: COLORS.primaryLight,
    fontWeight: '700',
  },
  dropdownButton: {
    justifyContent: 'center',
  },
  dropdownButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '700',
  },
  dropdownPlaceholderText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
  },
  inputOtp: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 24,
    fontWeight: '700',
  },
  otpNotice: {
    ...TYPOGRAPHY.caption,
    color: COLORS.warning,
    textAlign: 'center',
  },
  rowSplit: {
    flexDirection: 'row',
    columnGap: SPACING.md,
  },
  flex1: {
    flex: 1,
  },
  buttonBase: {
    height: SIZES.buttonHeight,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    columnGap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.glowGreen,
  },
  buttonSecondary: {
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonAmber: {
    backgroundColor: COLORS.secondary,
    ...(IS_WEB
      ? {}
      : {
          shadowColor: COLORS.secondary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 18,
          elevation: 7,
        }),
  },
  buttonSuccess: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.glowGreen,
  },
  buttonTopSpace: {
    marginTop: SPACING.md,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.body.fontSize,
    fontWeight: '700',
  },
  sectionTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
  },
  sectionTitleSpacing: {
    marginTop: SPACING.xxl,
  },
  bentoRow: {
    flexDirection: 'row',
    columnGap: SPACING.md,
  },
  bentoCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    borderRadius: SIZES.radiusXl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    rowGap: SPACING.sm,
    ...SHADOWS.card,
  },
  bentoCardGreen: {
    borderColor: 'rgba(16,185,129,0.35)',
    ...(IS_WEB
      ? {}
      : {
          shadowColor: COLORS.glowGreen,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 18,
          elevation: 8,
        }),
  },
  bentoCardAmber: {
    borderColor: 'rgba(245,158,11,0.35)',
    ...(IS_WEB
      ? {}
      : {
          shadowColor: COLORS.secondary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 16,
          elevation: 7,
        }),
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconBadgeGreen: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  iconBadgeAmber: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  bentoTitle: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text,
  },
  historyCard: {
    backgroundColor: 'rgba(20,20,30,0.6)',
    borderRadius: SIZES.radiusMd,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    rowGap: SPACING.xs,
    ...SHADOWS.card,
  },
  historyText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSoft,
  },
  historyTextStrong: {
    fontSize: TYPOGRAPHY.body.fontSize,
    fontWeight: '700',
    color: COLORS.primaryLight,
  },
  kitchenCard: {
    marginBottom: SPACING.lg,
  },
  kitchenTableText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSoft,
  },
  kitchenItemText: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
    marginVertical: SPACING.sm,
  },
  kitchenNote: {
    ...TYPOGRAPHY.caption,
    color: COLORS.warning,
    marginBottom: SPACING.sm,
  },
  orderCard: {
    marginBottom: SPACING.lg,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  orderTableText: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text,
  },
  statusBadge: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPending: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.35)',
  },
  statusProgress: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.35)',
  },
  statusLowStock: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.35)',
  },
  statusText: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.text,
    fontWeight: '600',
  },
  orderItems: {
    rowGap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderItemText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    flex: 1,
    paddingRight: SPACING.md,
  },
  itemStatus: {
    ...TYPOGRAPHY.tiny,
  },
  itemStatusReady: {
    color: COLORS.success,
  },
  itemStatusPreparing: {
    color: COLORS.primaryLight,
  },
  itemStatusDefault: {
    color: COLORS.textMuted,
  },
  metricGrid: {
    rowGap: SPACING.md,
  },
  moduleGrid: {
    rowGap: SPACING.md,
  },
  inventoryToolbar: {
    rowGap: SPACING.md,
  },
  formCard: {
    rowGap: SPACING.md,
  },
  disabledBlock: {
    padding: SPACING.lg,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  filterChip: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(10,12,20,0.65)',
  },
  filterChipActive: {
    borderColor: 'rgba(16,185,129,0.35)',
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  filterChipText: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: COLORS.primaryLight,
  },
  recipeDropdownList: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radiusMd,
    backgroundColor: 'rgba(5,5,8,0.76)',
    padding: SPACING.sm,
    rowGap: SPACING.sm,
  },
  recipeDropdownItem: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(10,12,20,0.65)',
  },
  recipeUnitPicker: {
    flex: 1,
    alignItems: 'center',
  },
  inventoryItemCard: {
    rowGap: SPACING.md,
  },
  inventoryActionRow: {
    flexDirection: 'row',
    columnGap: SPACING.sm,
  },
  moduleCard: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    rowGap: SPACING.sm,
  },
  moduleCardDisabled: {
    opacity: 0.7,
  },
  moduleLabel: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text,
  },
  moduleMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primaryLight,
  },
  moduleBadge: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  moduleBadgeText: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.warning,
    fontWeight: '600',
  },
  metricCard: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  metricLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  metricValue: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
  },
  staffCard: {
    rowGap: SPACING.md,
  },
  staffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: SPACING.md,
  },
  staffInfo: {
    flex: 1,
    rowGap: SPACING.xs,
  },
  staffName: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text,
  },
  staffMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSoft,
  },
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  qrModalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
    rowGap: SPACING.md,
  },
  qrStoreName: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.primaryLight,
    textAlign: 'center',
  },
  qrTableNumber: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
    textAlign: 'center',
  },
  qrCodeFrame: {
    width: 232,
    height: 232,
    borderRadius: SIZES.radiusMd,
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  qrInstruction: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text,
    textAlign: 'center',
  },
  qrMetaLabel: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  qrUrlText: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textSoft,
    lineHeight: 18,
    maxWidth: '100%',
    flexShrink: 1,
  },
  header: {
    backgroundColor: '#0B0B14',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.14)',
    ...(IS_WEB
      ? {}
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 14,
          elevation: 6,
        }),
  },
  headerWide: {
    backgroundColor: '#090A12',
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerRight: {
    marginRight: SPACING.lg,
  },
  headerTitleWrap: {
    minWidth: 0,
    justifyContent: 'center',
    rowGap: 1,
  },
  headerEyebrow: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.primaryLight,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  headerMainTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '800',
  },
  headerSubtitle: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: SPACING.sm,
    marginRight: SPACING.lg,
  },
  headerStatusPill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerStatusDotOnline: {
    backgroundColor: COLORS.primaryLight,
  },
  headerStatusDotOffline: {
    backgroundColor: COLORS.warning,
  },
  headerStatusText: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textSoft,
    fontWeight: '700',
  },
  headerUserPill: {
    maxWidth: 230,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: SPACING.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.18)',
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  headerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  headerAvatarText: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.background,
    fontWeight: '900',
  },
  headerUserTextWrap: {
    minWidth: 0,
    flex: 1,
  },
  headerUserRole: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.text,
    fontWeight: '800',
  },
  headerUserEmail: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textMuted,
  },
  headerLogoutButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.28)',
    backgroundColor: 'rgba(245,158,11,0.10)',
  },
  headerLogoutText: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.secondaryLight,
    fontWeight: '800',
  },
  tabBar: {
    backgroundColor: COLORS.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  tabBarSide: {
    width: 232,
    borderTopWidth: 0,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SPACING.sm,
  },
  tabBarLabel: {
    ...TYPOGRAPHY.tiny,
    fontWeight: '600',
  },
  sidebarShell: {
    width: 220,
    minWidth: 220,
    maxWidth: 220,
    flexGrow: 0,
    flexShrink: 0,
    height: '100%',
    backgroundColor: '#0B0D16',
    borderRightWidth: 1,
    borderRightColor: 'rgba(148,163,184,0.16)',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  sidebarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.md,
  },
  sidebarLogo: {
    width: 38,
    height: 38,
    borderRadius: SIZES.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  sidebarBrandText: {
    minWidth: 0,
    flex: 1,
  },
  sidebarBrandTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontWeight: '900',
  },
  sidebarBrandSubtitle: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  sidebarStoreCard: {
    rowGap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.18)',
    backgroundColor: 'rgba(16,185,129,0.08)',
    marginBottom: SPACING.lg,
  },
  sidebarStoreLabel: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sidebarStoreName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '800',
  },
  sidebarStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: SPACING.sm,
  },
  sidebarStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sidebarStatusText: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textSoft,
    fontWeight: '700',
  },
  sidebarSectionLabel: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textMuted,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarScrollContent: {
    paddingBottom: SPACING.sm,
    rowGap: 2,
  },
  sidebarItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: SPACING.sm,
    borderRadius: SIZES.radiusSm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
  },
  sidebarItemActive: {
    borderColor: 'rgba(52,211,153,0.30)',
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  sidebarActiveRail: {
    position: 'absolute',
    left: 0,
    top: SPACING.sm,
    bottom: SPACING.sm,
    width: 3,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
  },
  sidebarIconBox: {
    width: 32,
    height: 32,
    borderRadius: SIZES.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  sidebarIconBoxActive: {
    backgroundColor: 'rgba(16,185,129,0.18)',
  },
  sidebarItemCopy: {
    minWidth: 0,
    flex: 1,
    rowGap: 2,
  },
  sidebarItemLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSoft,
    fontWeight: '800',
  },
  sidebarItemLabelActive: {
    color: COLORS.text,
  },
  sidebarItemSubtitle: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textMuted,
  },
  sidebarFooter: {
    rowGap: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.14)',
  },
  sidebarUserCard: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: SPACING.sm,
    padding: SPACING.xs,
    borderRadius: SIZES.radiusMd,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  sidebarAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  sidebarAvatarText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.background,
    fontWeight: '900',
  },
  sidebarUserCopy: {
    minWidth: 0,
    flex: 1,
  },
  sidebarUserRole: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontWeight: '800',
  },
  sidebarUserEmail: {
    ...TYPOGRAPHY.tiny,
    color: COLORS.textMuted,
  },
  sidebarLogoutButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: SPACING.sm,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.26)',
    backgroundColor: 'rgba(245,158,11,0.10)',
  },
  sidebarLogoutText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondaryLight,
    fontWeight: '800',
  },
});

