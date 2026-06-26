import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { ScreenBackdrop } from "../../components/common/ScreenBackdrop";
import { runConfirmedAction } from "../../components/common/ConfirmAction";
import {
  EmptyStateView,
  ErrorStateView,
  LoadingView,
  RestrictedStateView,
} from "../../components/StateViews";
import { MANAGEMENT_ROLES } from "../../constants/roles";
import {
  changeStaffRole,
  createStaffUser,
  deactivateStaffUser,
  getStaffPermissionCatalog,
  getStaffUsers,
  lockStaffUser,
  resetStaffPassword,
  unlockStaffUser,
  updateStaffPermissionOverrides,
  updateStaffUser,
  type StaffPermission,
  type StaffPermissionCatalog,
  type StaffRole,
  type StaffStatus,
  type StaffUser,
} from "../../services/staff";
import { styles } from "../../styles/appStyles";
import { COLORS } from "../../theme";
import { hasPermission } from "../../utils/permissions";
import {
  ADMIN_STAFF_CREATE_ROLE_OPTIONS,
  MANAGER_STAFF_CREATE_ROLE_OPTIONS,
  STAFF_EDIT_ROLE_OPTIONS,
  STAFF_STATUS_FILTER_OPTIONS,
  type StaffEditableRole,
  type StaffFilterRole,
  type StaffFilterStatus,
} from "../../utils/staffForms";
function getStaffStatusLabel(status: StaffStatus) {
  if (status === "LOCKED") return "Đã khóa";
  if (status === "DELETED") return "Vô hiệu hóa";
  return "Đang hoạt động";
}

function getStaffRoleLabel(role: StaffUser["role"]) {
  if (role === "ADMIN") return "Chủ quán/Admin";
  if (role === "MANAGER") return "Quản lý";
  if (role === "KITCHEN") return "Nhân viên bếp";
  if (role === "USER") return "Nhân viên";
  return "Chủ hệ thống";
}

function getStaffLoginIdentifier(member: StaffUser) {
  return member.email || "";
}

function getPermissionLabel(permission: StaffPermission) {
  const labels: Record<StaffPermission, string> = {
    ORDER_CANCEL_LATE: "Huy mon tre",
    ORDER_MARK_FREE: "Danh dau mien phi",
    ORDER_DISCOUNT: "Giam gia",
    ORDER_REFUND: "Hoan tien",
    REPORT_VIEW: "Xem bao cao",
    INVENTORY_ADJUST: "Dieu chinh kho",
    PAYROLL_CONFIRM: "Xac nhan bang luong",
    PRINT_QUEUE_MANAGE: "Quan ly hang doi in",
    INVOICE_VIEW: "Xem phieu tinh tien",
    INVOICE_PRINT_REQUEST: "Yeu cau in phieu",
    CASHIER_SHIFT_OPEN: "Mo ca quay",
    CASHIER_SHIFT_CLOSE: "Dong ca quay",
    CASHIER_SHIFT_VIEW_HISTORY: "Xem lich su ca",
    STAFF_PERMISSION_MANAGE: "Quan ly phan quyen",
    MENU_MANAGE: "Quan ly menu",
    TABLE_MANAGE: "Quan ly ban",
  };
  return labels[permission] || permission;
}

function calculateEffectivePermissions(
  member: StaffUser,
  catalog: StaffPermissionCatalog | null,
  allow: StaffPermission[],
  deny: StaffPermission[],
) {
  const base = catalog?.roleDefaults?.[member.role] || [];
  const denySet = new Set(deny);
  return Array.from(new Set([...base, ...allow])).filter(
    (permission) => !denySet.has(permission),
  );
}

function normalizeEditableRole(role: StaffUser["role"]): StaffEditableRole {
  if (STAFF_EDIT_ROLE_OPTIONS.includes(role as StaffEditableRole)) {
    return role as StaffEditableRole;
  }
  return "USER";
}

function parseStaffEmail(rawValue: string): { email?: string; error?: string } {
  const value = rawValue.trim();
  if (!value) {
    return { error: "Email tài khoản là bắt buộc" };
  }

  const normalizedEmail = value.toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalizedEmail)) {
    return { error: "Email không hợp lệ" };
  }
  return { email: normalizedEmail };
}

function parseStaffPhone(rawValue: string): { phone?: string; error?: string } {
  const value = rawValue.trim();
  if (!value) return {};
  const normalizedPhone = value.replace(/\s+/g, "");
  if (!/^\+?\d{6,15}$/.test(normalizedPhone)) {
    return { error: "Số điện thoại không hợp lệ" };
  }
  return { phone: normalizedPhone };
}

function getStaffCreateRoleOptions(
  currentRole?: StaffRole | null,
): StaffEditableRole[] {
  if (currentRole === "ADMIN") return ADMIN_STAFF_CREATE_ROLE_OPTIONS;
  if (currentRole === "MANAGER") return MANAGER_STAFF_CREATE_ROLE_OPTIONS;
  return [];
}

export function StaffManagementScreen() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffFilterRole>("ALL");
  const [statusFilter, setStatusFilter] = useState<StaffFilterStatus>("ALL");

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingMember, setEditingMember] = useState<StaffUser | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<StaffEditableRole>("USER");
  const [formHourlyWage, setFormHourlyWage] = useState("");
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [creationNote, setCreationNote] = useState("");

  const canAdminManageStaff = user?.role === "ADMIN";
  const canManageStaffPermissions = hasPermission(
    user,
    "STAFF_PERMISSION_MANAGE",
  );
  const staffCreateRoleOptions = getStaffCreateRoleOptions(
    user?.role as StaffRole | undefined,
  );
  const canCreateStaff = staffCreateRoleOptions.length > 0;
  const [permissionCatalog, setPermissionCatalog] =
    useState<StaffPermissionCatalog | null>(null);
  const [permissionMember, setPermissionMember] = useState<StaffUser | null>(
    null,
  );
  const [permissionAllow, setPermissionAllow] = useState<StaffPermission[]>([]);
  const [permissionDeny, setPermissionDeny] = useState<StaffPermission[]>([]);
  const [permissionError, setPermissionError] = useState("");
  const [permissionSubmitting, setPermissionSubmitting] = useState(false);

  const fetchStaff = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError("");
      const rows = await getStaffUsers();
      setStaff(rows);
    } catch (err: any) {
      setLoadError(
        err.response?.data?.message || "Không thể tải dữ liệu nhân sự",
      );
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    if (!canManageStaffPermissions) return;
    getStaffPermissionCatalog()
      .then(setPermissionCatalog)
      .catch(() => setPermissionCatalog(null));
  }, [canManageStaffPermissions]);

  const resetForm = useCallback(() => {
    setFormMode(null);
    setEditingMember(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormRole("USER");
    setFormHourlyWage("");
    setFormError("");
  }, []);

  const openCreateForm = useCallback(() => {
    if (!canCreateStaff) {
      Alert.alert("Không đủ quyền", "Bạn không có quyền tạo nhân viên.");
      return;
    }
    setCreationNote("");
    setFormMode("create");
    setEditingMember(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormRole(staffCreateRoleOptions[0] || "USER");
    setFormHourlyWage("");
    setFormError("");
  }, [canCreateStaff, staffCreateRoleOptions]);

  const openEditForm = useCallback(
    (member: StaffUser) => {
      if (!canAdminManageStaff) {
        Alert.alert("Không đủ quyền", "Cần quyền ADMIN để sửa nhân viên.");
        return;
      }
      if (member.role === "SYSTEM_OWNER") {
        Alert.alert("Không hỗ trợ", "Không thể sửa tài khoản SYSTEM_OWNER.");
        return;
      }

      setCreationNote("");
      setFormMode("edit");
      setEditingMember(member);
      setFormName(member.name || "");
      setFormEmail(member.email || "");
      setFormPhone(member.phone || "");
      setFormRole(normalizeEditableRole(member.role));
      setFormHourlyWage(
        member.salaryConfig?.baseHourly === undefined ||
          member.salaryConfig?.baseHourly === null
          ? ""
          : String(member.salaryConfig.baseHourly),
      );
      setFormError("");
    },
    [canAdminManageStaff],
  );

  const saveStaffForm = useCallback(async () => {
    if (formMode === "create" && !canCreateStaff) {
      setFormError("Bạn không có quyền tạo nhân viên");
      return;
    }
    if (formMode === "edit" && !canAdminManageStaff) {
      setFormError("Cần quyền ADMIN để sửa nhân viên");
      return;
    }

    const name = formName.trim();
    if (!name) {
      setFormError("Tên nhân viên là bắt buộc");
      return;
    }

    const emailIdentity = parseStaffEmail(formEmail);
    if (emailIdentity.error) {
      setFormError(emailIdentity.error);
      return;
    }
    const phoneIdentity = parseStaffPhone(formPhone);
    if (phoneIdentity.error) {
      setFormError(phoneIdentity.error);
      return;
    }

    let baseHourly: number | undefined;
    if (formHourlyWage.trim()) {
      const parsedHourlyWage = Number(formHourlyWage);
      if (!Number.isFinite(parsedHourlyWage) || parsedHourlyWage < 0) {
        setFormError("Lương theo giờ phải là số không âm");
        return;
      }
      baseHourly = parsedHourlyWage;
    }

    setFormSubmitting(true);
    setFormError("");
    try {
      if (formMode === "create") {
        const created = await createStaffUser({
          name,
          role: formRole,
          email: emailIdentity.email,
          phone: phoneIdentity.phone,
          baseHourly,
        });
        setCreationNote(
          created.tempPassword
            ? `Mật khẩu tạm thời: ${created.tempPassword}. Nhân viên đăng nhập bằng email và sẽ xác thực OTP qua email.`
            : "Đã tạo nhân viên. Nhân viên đăng nhập bằng email và sẽ xác thực OTP qua email.",
        );
      } else if (formMode === "edit" && editingMember) {
        if (
          editingMember._id === user?.userId &&
          formRole !== editingMember.role
        ) {
          setFormError("Không thể đổi role của tài khoản đang đăng nhập");
          return;
        }

        await updateStaffUser(editingMember._id, {
          name,
          email: emailIdentity.email || "",
          phone: phoneIdentity.phone || "",
          baseHourly,
        });

        if (formRole !== editingMember.role) {
          await changeStaffRole(editingMember._id, formRole);
        }
      }

      resetForm();
      void fetchStaff(true);
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Không thể lưu nhân viên");
    } finally {
      setFormSubmitting(false);
    }
  }, [
    canAdminManageStaff,
    canCreateStaff,
    editingMember,
    fetchStaff,
    formEmail,
    formHourlyWage,
    formMode,
    formName,
    formPhone,
    formRole,
    resetForm,
    user?.userId,
  ]);

  const handleToggleLock = useCallback(
    (member: StaffUser) => {
      if (!canAdminManageStaff) {
        Alert.alert(
          "Không đủ quyền",
          "Cần quyền ADMIN để khóa/mở khóa tài khoản.",
        );
        return;
      }
      if (!user) return;
      if (member._id === user.userId) {
        Alert.alert("Không hợp lệ", "Không thể khóa tài khoản đang đăng nhập.");
        return;
      }
      if (member.role === "SYSTEM_OWNER") {
        Alert.alert("Không hợp lệ", "Không thể khóa/mở khóa SYSTEM_OWNER.");
        return;
      }
      if (member.status !== "LOCKED" && member.role === "ADMIN") {
        Alert.alert(
          "Không hợp lệ",
          "Không khóa tài khoản Admin để tránh mất quyền quản trị.",
        );
        return;
      }
      if (member.status === "DELETED") {
        Alert.alert("Không hợp lệ", "Tài khoản đã vô hiệu hóa.");
        return;
      }

      const isLocked = member.status === "LOCKED";
      runConfirmedAction({
        title: isLocked ? "Mở khóa tài khoản" : "Khóa tài khoản",
        message: isLocked
          ? `Bạn muốn mở khóa tài khoản ${member.name}?`
          : `Bạn muốn khóa tài khoản ${member.name}?`,
        confirmText: "Xác nhận",
        onConfirm: async () => {
          try {
            if (isLocked) {
              await unlockStaffUser(member._id);
            } else {
              await lockStaffUser(member._id);
            }
            void fetchStaff(true);
          } catch (err: any) {
            Alert.alert(
              "Lỗi",
              err.response?.data?.message ||
                "Không thể cập nhật trạng thái tài khoản",
            );
          }
        },
      });
    },
    [canAdminManageStaff, fetchStaff, user],
  );

  const handleDeactivate = useCallback(
    (member: StaffUser) => {
      if (!canAdminManageStaff) {
        Alert.alert(
          "Không đủ quyền",
          "Cần quyền ADMIN để vô hiệu hóa nhân viên.",
        );
        return;
      }
      if (!user) return;
      if (member._id === user.userId) {
        Alert.alert(
          "Không hợp lệ",
          "Không thể vô hiệu hóa tài khoản đang đăng nhập.",
        );
        return;
      }
      if (member.role === "SYSTEM_OWNER" || member.role === "ADMIN") {
        Alert.alert("Không hợp lệ", "Không vô hiệu hóa tài khoản quản trị.");
        return;
      }
      if (member.status === "DELETED") {
        Alert.alert("Thông báo", "Tài khoản này đã vô hiệu hóa.");
        return;
      }

      runConfirmedAction({
        title: "Vô hiệu hóa nhân viên",
        message: `Bạn chắc chắn muốn vô hiệu hóa ${member.name}?`,
        confirmText: "Vô hiệu hóa",
        destructive: true,
        onConfirm: async () => {
          try {
            await deactivateStaffUser(member._id);
            void fetchStaff(true);
          } catch (err: any) {
            Alert.alert(
              "Lỗi",
              err.response?.data?.message || "Không thể vô hiệu hóa nhân viên",
            );
          }
        },
      });
    },
    [canAdminManageStaff, fetchStaff, user],
  );

  const handleResetPassword = useCallback(
    (member: StaffUser) => {
      if (!canAdminManageStaff) {
        Alert.alert("Không đủ quyền", "Cần quyền ADMIN để reset mật khẩu.");
        return;
      }
      if (member.role === "SYSTEM_OWNER") {
        Alert.alert(
          "Không hợp lệ",
          "Không reset mật khẩu SYSTEM_OWNER tại đây.",
        );
        return;
      }

      runConfirmedAction({
        title: "Reset mật khẩu",
        message: `Bạn muốn reset mật khẩu cho ${member.name}?`,
        confirmText: "Reset",
        onConfirm: async () => {
          try {
            const result = await resetStaffPassword(member._id);
            Alert.alert(
              "Đã reset mật khẩu",
              result.tempPassword
                ? `Mật khẩu tạm thời: ${result.tempPassword}\nNhân viên nên đổi mật khẩu sau khi đăng nhập.`
                : "Reset mật khẩu thành công.",
            );
          } catch (err: any) {
            Alert.alert(
              "Lỗi",
              err.response?.data?.message || "Không thể reset mật khẩu",
            );
          }
        },
      });
    },
    [canAdminManageStaff],
  );

  const openPermissionPanel = useCallback(
    (member: StaffUser) => {
      if (!canManageStaffPermissions) {
        Alert.alert("Khong du quyen", "Ban khong co quyen quan ly phan quyen.");
        return;
      }
      if (member.role === "SYSTEM_OWNER") {
        Alert.alert("Khong ho tro", "Khong the sua quyen SYSTEM_OWNER.");
        return;
      }
      setPermissionMember(member);
      setPermissionAllow(member.permissionOverrides?.allow || []);
      setPermissionDeny(member.permissionOverrides?.deny || []);
      setPermissionError("");
    },
    [canManageStaffPermissions],
  );

  const togglePermissionOverride = useCallback(
    (permission: StaffPermission, mode: "allow" | "deny") => {
      if (mode === "allow") {
        setPermissionAllow((current) =>
          current.includes(permission)
            ? current.filter((item) => item !== permission)
            : [...current, permission],
        );
        setPermissionDeny((current) =>
          current.filter((item) => item !== permission),
        );
        return;
      }

      setPermissionDeny((current) =>
        current.includes(permission)
          ? current.filter((item) => item !== permission)
          : [...current, permission],
      );
      setPermissionAllow((current) =>
        current.filter((item) => item !== permission),
      );
    },
    [],
  );

  const savePermissionPanel = useCallback(async () => {
    if (!permissionMember) return;
    setPermissionSubmitting(true);
    setPermissionError("");
    try {
      await updateStaffPermissionOverrides(permissionMember._id, {
        allow: permissionAllow,
        deny: permissionDeny,
      });
      setPermissionMember(null);
      setPermissionAllow([]);
      setPermissionDeny([]);
      void fetchStaff(true);
    } catch (err: any) {
      setPermissionError(
        err.response?.data?.message || "Khong the luu phan quyen",
      );
    } finally {
      setPermissionSubmitting(false);
    }
  }, [fetchStaff, permissionAllow, permissionDeny, permissionMember]);

  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Bạn không có quyền truy cập màn hình nhân sự." />
      </View>
    );
  }

  if (screenLoading) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <LoadingView />
      </View>
    );
  }

  const keyword = search.trim().toLowerCase();
  const filteredStaff = staff.filter((member) => {
    if (roleFilter !== "ALL" && member.role !== roleFilter) {
      return false;
    }
    if (statusFilter !== "ALL" && member.status !== statusFilter) {
      return false;
    }

    if (!keyword) return true;

    const username = getStaffLoginIdentifier(member).toLowerCase();
    const searchable =
      `${member.name || ""} ${username} ${member.email || ""} ${member.phone || ""} ${member.role}`.toLowerCase();
    return searchable.includes(keyword);
  });

  const activeCount = staff.filter(
    (member) => member.status === "ACTIVE",
  ).length;
  const lockedCount = staff.filter(
    (member) => member.status === "LOCKED",
  ).length;
  const inactiveCount = staff.filter(
    (member) => member.status === "DELETED",
  ).length;

  return (
    <View style={styles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void fetchStaff(true)}
          />
        }
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Quản lý nhân sự</Text>

          <View style={styles.metricGrid}>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Đang hoạt động</Text>
              <Text style={styles.metricValue}>{activeCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Đã khóa</Text>
              <Text style={styles.metricValue}>{lockedCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Vô hiệu hóa</Text>
              <Text style={styles.metricValue}>{inactiveCount}</Text>
            </View>
          </View>

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <TextInput
              placeholder="Tìm theo tên nhân viên / tài khoản"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={styles.helperText}>Lọc theo vai trò</Text>
            <View style={styles.filterRow}>
              {(["ALL", "ADMIN", "MANAGER", "USER", "KITCHEN"] as const).map(
                (role) => {
                  const selected = roleFilter === role;
                  return (
                    <TouchableOpacity
                      key={role}
                      activeOpacity={0.8}
                      style={[
                        styles.filterChip,
                        selected ? styles.filterChipActive : null,
                      ]}
                      onPress={() => setRoleFilter(role)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selected ? styles.filterChipTextActive : null,
                        ]}
                      >
                        {role === "ALL" ? "Tất cả" : getStaffRoleLabel(role)}
                      </Text>
                    </TouchableOpacity>
                  );
                },
              )}
            </View>

            <Text style={styles.helperText}>Lọc theo trạng thái</Text>
            <View style={styles.filterRow}>
              {STAFF_STATUS_FILTER_OPTIONS.map((status) => {
                const selected = statusFilter === status;
                return (
                  <TouchableOpacity
                    key={status}
                    activeOpacity={0.8}
                    style={[
                      styles.filterChip,
                      selected ? styles.filterChipActive : null,
                    ]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selected ? styles.filterChipTextActive : null,
                      ]}
                    >
                      {status === "ALL"
                        ? "Tất cả"
                        : getStaffStatusLabel(status)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {canCreateStaff ? (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.buttonBase, styles.buttonPrimary]}
                onPress={openCreateForm}
              >
                <Text style={styles.buttonText}>Thêm nhân viên</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={1}
                disabled
                style={[
                  styles.buttonBase,
                  styles.buttonSecondary,
                  styles.moduleCardDisabled,
                ]}
              >
                <Text style={styles.buttonText}>Thêm nhân viên</Text>
              </TouchableOpacity>
            )}

            {!canCreateStaff ? (
              <Text style={styles.helperText}>
                Bạn không có quyền tạo nhân viên.
              </Text>
            ) : null}
            {!canAdminManageStaff && canCreateStaff ? (
              <Text style={styles.helperText}>
                MANAGER chỉ được tạo nhân viên và bếp; các thao tác
                sửa/khóa/reset cần ADMIN.
              </Text>
            ) : null}
          </View>

          {formMode ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>
                {formMode === "create" ? "Thêm nhân viên" : "Sửa nhân viên"}
              </Text>
              {formError ? (
                <Text style={styles.errorText}>{formError}</Text>
              ) : null}

              <TextInput
                placeholder="Tên nhân viên"
                value={formName}
                onChangeText={setFormName}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                placeholder="Email tài khoản"
                value={formEmail}
                onChangeText={setFormEmail}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                placeholder="Số điện thoại (tùy chọn)"
                value={formPhone}
                onChangeText={setFormPhone}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                keyboardType="phone-pad"
              />
              <TextInput
                placeholder="Lương theo giờ (tùy chọn)"
                value={formHourlyWage}
                onChangeText={setFormHourlyWage}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                keyboardType="decimal-pad"
              />

              <Text style={styles.helperText}>Vị trí làm việc</Text>
              <View style={styles.filterRow}>
                {(formMode === "create"
                  ? staffCreateRoleOptions
                  : STAFF_EDIT_ROLE_OPTIONS
                ).map((role) => {
                  const selected = formRole === role;
                  const disableRoleSelection =
                    (formMode === "edit" && editingMember?.role === "ADMIN") ||
                    (formMode === "edit" &&
                      editingMember?._id === user.userId &&
                      role !== editingMember.role);
                  return (
                    <TouchableOpacity
                      key={role}
                      activeOpacity={0.8}
                      disabled={disableRoleSelection}
                      style={[
                        styles.filterChip,
                        selected ? styles.filterChipActive : null,
                        disableRoleSelection ? styles.moduleCardDisabled : null,
                      ]}
                      onPress={() => setFormRole(role)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selected ? styles.filterChipTextActive : null,
                        ]}
                      >
                        {getStaffRoleLabel(role)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {formMode === "create" ? (
                <Text style={styles.helperText}>
                  Máy chủ sẽ tạo mật khẩu tạm thời nếu không nhập mật khẩu
                  riêng.
                </Text>
              ) : null}

              <View style={styles.rowSplit}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.buttonBase,
                    styles.buttonSecondary,
                    styles.flex1,
                  ]}
                  onPress={resetForm}
                >
                  <Text style={styles.buttonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.buttonBase,
                    styles.buttonPrimary,
                    styles.flex1,
                  ]}
                  onPress={() => void saveStaffForm()}
                >
                  {formSubmitting ? (
                    <ActivityIndicator color={COLORS.text} />
                  ) : (
                    <Text style={styles.buttonText}>Lưu nhân viên</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {creationNote ? (
            <Text style={styles.otpNotice}>{creationNote}</Text>
          ) : null}

          {permissionMember && permissionCatalog ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <View style={styles.staffHeader}>
                <View style={styles.staffInfo}>
                  <Text style={styles.sectionTitle}>
                    Phan quyen:{" "}
                    {permissionMember.name || permissionMember.email}
                  </Text>
                  <Text style={styles.helperText}>
                    Deny luon thang Allow. Backend van chan neu goi API truc
                    tiep.
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setPermissionMember(null)}
                >
                  <Text style={styles.staffMeta}>Dong</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inventoryActionRow}>
                <View style={[styles.metricCard, styles.flex1]}>
                  <Text style={styles.metricLabel}>Mac dinh theo role</Text>
                  <Text style={styles.metricValue}>
                    {permissionCatalog.roleDefaults?.[permissionMember.role]
                      ?.length || 0}
                  </Text>
                </View>
                <View style={[styles.metricCard, styles.flex1]}>
                  <Text style={styles.metricLabel}>Hieu luc</Text>
                  <Text style={styles.metricValue}>
                    {
                      calculateEffectivePermissions(
                        permissionMember,
                        permissionCatalog,
                        permissionAllow,
                        permissionDeny,
                      ).length
                    }
                  </Text>
                </View>
              </View>

              {permissionCatalog.permissions.map((permission) => {
                const allowed = permissionAllow.includes(permission);
                const denied = permissionDeny.includes(permission);
                const defaultEnabled =
                  permissionCatalog.roleDefaults?.[
                    permissionMember.role
                  ]?.includes(permission);
                return (
                  <View key={permission} style={styles.inventoryActionRow}>
                    <View style={styles.flex1}>
                      <Text style={styles.staffName}>
                        {getPermissionLabel(permission)}
                      </Text>
                      <Text style={styles.staffMeta}>
                        {defaultEnabled
                          ? "Mac dinh co quyen"
                          : "Mac dinh khong co quyen"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.filterChip,
                        allowed ? styles.filterChipActive : null,
                      ]}
                      onPress={() =>
                        togglePermissionOverride(permission, "allow")
                      }
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          allowed ? styles.filterChipTextActive : null,
                        ]}
                      >
                        Allow
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.filterChip,
                        denied ? styles.filterChipActive : null,
                      ]}
                      onPress={() =>
                        togglePermissionOverride(permission, "deny")
                      }
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          denied ? styles.filterChipTextActive : null,
                        ]}
                      >
                        Deny
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {permissionError ? (
                <Text style={styles.errorText}>{permissionError}</Text>
              ) : null}
              <View style={styles.rowSplit}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.buttonBase,
                    styles.buttonSecondary,
                    styles.flex1,
                  ]}
                  onPress={() => setPermissionMember(null)}
                >
                  <Text style={styles.buttonText}>Huy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.buttonBase,
                    styles.buttonPrimary,
                    styles.flex1,
                  ]}
                  onPress={() => void savePermissionPanel()}
                >
                  {permissionSubmitting ? (
                    <ActivityIndicator color={COLORS.text} />
                  ) : (
                    <Text style={styles.buttonText}>Luu quyen</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {loadError ? (
            <ErrorStateView
              message={loadError}
              onRetry={() => void fetchStaff()}
            />
          ) : null}

          {!loadError && filteredStaff.length === 0 ? (
            <EmptyStateView message="Không có nhân viên nào phù hợp bộ lọc." />
          ) : (
            filteredStaff.map((member) => {
              const statusStyle =
                member.status === "LOCKED"
                  ? styles.statusPending
                  : member.status === "DELETED"
                    ? styles.statusLowStock
                    : styles.statusProgress;
              const username =
                getStaffLoginIdentifier(member) || "Chưa có tên tài khoản";
              const canEdit =
                canAdminManageStaff &&
                member.role !== "SYSTEM_OWNER" &&
                member.role !== "ADMIN";
              const canDeactivate =
                canAdminManageStaff &&
                member._id !== user.userId &&
                member.role !== "SYSTEM_OWNER" &&
                member.role !== "ADMIN" &&
                member.status !== "DELETED";
              const canResetPassword =
                canAdminManageStaff && member.role !== "SYSTEM_OWNER";
              const canManagePermissions =
                canManageStaffPermissions && member.role !== "SYSTEM_OWNER";
              const canToggleLock =
                canAdminManageStaff &&
                member._id !== user.userId &&
                member.role !== "SYSTEM_OWNER" &&
                member.status !== "DELETED" &&
                (member.role !== "ADMIN" || member.status === "LOCKED");

              return (
                <View
                  key={member._id}
                  style={[styles.glassCard, styles.staffCard]}
                >
                  <View style={styles.staffHeader}>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>
                        {member.name || "Nhân viên"}
                      </Text>
                      <Text style={styles.staffMeta}>
                        Email tài khoản: {username}
                      </Text>
                      <Text style={styles.staffMeta}>
                        Số điện thoại: {member.phone || "-"}
                      </Text>
                      <Text style={styles.staffMeta}>
                        Vai trò: {getStaffRoleLabel(member.role)}
                      </Text>
                      <Text style={styles.staffMeta}>
                        Vị trí làm việc: {getStaffRoleLabel(member.role)}
                      </Text>
                      <Text style={styles.staffMeta}>
                        Lương theo giờ:{" "}
                        {member.salaryConfig?.baseHourly === undefined ||
                        member.salaryConfig?.baseHourly === null
                          ? "Máy chủ chưa có"
                          : `${member.salaryConfig.baseHourly.toLocaleString()}d`}
                      </Text>
                      <Text style={styles.staffMeta}>
                        Tạo lúc:{" "}
                        {member.createdAt
                          ? new Date(member.createdAt).toLocaleString()
                          : "-"}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, statusStyle]}>
                      <Text style={styles.statusText}>
                        {getStaffStatusLabel(member.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.inventoryActionRow}>
                    {canEdit ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.buttonBase,
                          styles.buttonSecondary,
                          styles.flex1,
                        ]}
                        onPress={() => openEditForm(member)}
                      >
                        <Text style={styles.buttonText}>Sửa nhân viên</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={1}
                        disabled
                        style={[
                          styles.buttonBase,
                          styles.buttonSecondary,
                          styles.flex1,
                          styles.moduleCardDisabled,
                        ]}
                      >
                        <Text style={styles.buttonText}>Sửa nhân viên</Text>
                      </TouchableOpacity>
                    )}

                    {canToggleLock ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.buttonBase,
                          member.status === "LOCKED"
                            ? styles.buttonPrimary
                            : styles.buttonAmber,
                          styles.flex1,
                        ]}
                        onPress={() => handleToggleLock(member)}
                      >
                        <Text style={styles.buttonText}>
                          {member.status === "LOCKED"
                            ? "Mở khóa tài khoản"
                            : "Khóa tài khoản"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={1}
                        disabled
                        style={[
                          styles.buttonBase,
                          styles.buttonSecondary,
                          styles.flex1,
                          styles.moduleCardDisabled,
                        ]}
                      >
                        <Text style={styles.buttonText}>
                          {member.status === "LOCKED"
                            ? "Mở khóa tài khoản"
                            : "Khóa tài khoản"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.inventoryActionRow}>
                    {canResetPassword ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.buttonBase,
                          styles.buttonPrimary,
                          styles.flex1,
                        ]}
                        onPress={() => handleResetPassword(member)}
                      >
                        <Text style={styles.buttonText}>Reset mật khẩu</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={1}
                        disabled
                        style={[
                          styles.buttonBase,
                          styles.buttonSecondary,
                          styles.flex1,
                          styles.moduleCardDisabled,
                        ]}
                      >
                        <Text style={styles.buttonText}>Reset mật khẩu</Text>
                      </TouchableOpacity>
                    )}

                    {canDeactivate ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.buttonBase,
                          styles.buttonAmber,
                          styles.flex1,
                        ]}
                        onPress={() => handleDeactivate(member)}
                      >
                        <Text style={styles.buttonText}>Vô hiệu hóa</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={1}
                        disabled
                        style={[
                          styles.buttonBase,
                          styles.buttonSecondary,
                          styles.flex1,
                          styles.moduleCardDisabled,
                        ]}
                      >
                        <Text style={styles.buttonText}>Vô hiệu hóa</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.inventoryActionRow}>
                    {canManagePermissions ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.buttonBase,
                          styles.buttonSecondary,
                          styles.flex1,
                        ]}
                        onPress={() => openPermissionPanel(member)}
                      >
                        <Text style={styles.buttonText}>Phan quyen</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={1}
                        disabled
                        style={[
                          styles.buttonBase,
                          styles.buttonSecondary,
                          styles.flex1,
                          styles.moduleCardDisabled,
                        ]}
                      >
                        <Text style={styles.buttonText}>Phan quyen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
