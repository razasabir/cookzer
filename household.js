// Shared household helpers — every page that touches Family Profiles,
// the Meal Planner, or meal suggestions needs "my household's id"
// before it can query any of those tables, now that they're scoped to
// a household (shared with co-admins) instead of a single owner.
// Mirrors friends-widget.js's convention of taking `sb` explicitly
// rather than relying on a page-global.
(function () {
  // Creates the caller's household on first use (see migration 046) so
  // every page can call this the same way regardless of whether the
  // user has ever touched the planner before.
  async function getOrCreate(sb) {
    const { data: householdId, error: rpcError } = await sb.rpc('get_or_create_my_household');
    if (rpcError) throw rpcError;
    const { data: household, error } = await sb
      .from('households')
      .select('id, name, household_size')
      .eq('id', householdId)
      .single();
    if (error) throw error;
    return household;
  }

  async function listMembers(sb, householdId) {
    const { data, error } = await sb
      .from('household_members')
      .select('user_id, joined_at, profiles(display_name, initials, avatar_url)')
      .eq('household_id', householdId)
      .order('joined_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // Moves the invitee's existing family profiles / meal plan into the
  // caller's household (see add_household_co_admin in migration 046) —
  // not just a bare membership insert, so nothing they already had
  // silently disappears from their own view.
  async function addCoAdmin(sb, inviteeUserId) {
    const { data, error } = await sb.rpc('add_household_co_admin', { p_invitee_user_id: inviteeUserId });
    if (error) throw error;
    return data;
  }

  async function removeMember(sb, householdId, userId) {
    const { error } = await sb.from('household_members').delete().eq('household_id', householdId).eq('user_id', userId);
    if (error) throw error;
  }

  window.CookzerHousehold = { getOrCreate, listMembers, addCoAdmin, removeMember };
})();
