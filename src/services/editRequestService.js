import { supabase } from './supabase'

// দিন হিসাব করে কোন checker লাগবে বের করো
export const getRequiredChecker = (submissionDate) => {
  const today = new Date()
  const subDate = new Date(submissionDate)
  const diffDays = Math.floor((today - subDate) / (1000 * 60 * 60 * 24))
  if (diffDays <= 7) return { role: 'regional_checker', label: 'Regional Manager', days: diffDays }
  if (diffDays <= 365) return { role: 'divisional_checker', label: 'Divisional Manager', days: diffDays }
  return { role: 'central_checker', label: 'Central Checker', days: diffDays }
}

// Branch এর জন্য সঠিক checker খুঁজে বের করো
export const findCheckerForBranch = async (branchCode, checkerRole) => {
  // Branch এর region/division বের করো
  const { data: branch } = await supabase.from('branches')
    .select('region_id, division_id').eq('branch_code', branchCode).single()
  if (!branch) throw new Error('Branch পাওয়া যায়নি')

  let query = supabase.from('profiles').select('id, full_name, email').eq('role', checkerRole).eq('is_active', true)

  if (checkerRole === 'regional_checker' && branch.region_id)
    query = query.eq('region_id', branch.region_id)
  else if (checkerRole === 'divisional_checker' && branch.division_id)
    query = query.eq('division_id', branch.division_id)

  const { data } = await query
  return data || []
}

// Edit request তৈরি করো (Branch → Regional)
export const createEditRequest = async ({ submissionId, branchCode, requestedBy, requestReason, submissionDate }) => {
  const checkerInfo = getRequiredChecker(submissionDate)

  // সঠিক checker খুঁজো
  const checkers = await findCheckerForBranch(branchCode, checkerInfo.role)
  const assignedTo = checkers[0]?.id || null

  const { data, error } = await supabase.from('edit_requests').insert({
    submission_id: submissionId,
    branch_code: branchCode,
    requested_by: requestedBy,
    request_reason: requestReason,
    submission_date: submissionDate,
    days_old: checkerInfo.days,
    required_checker: checkerInfo.role,
    assigned_to: assignedTo,
    status: 'pending',
  }).select().single()
  if (error) throw error
  return { ...data, checkerInfo, assignedChecker: checkers[0] }
}

// Regional → Divisional/Central এ escalate করো
export const escalateEditRequest = async ({ submissionId, branchCode, requestedBy, requestReason, submissionDate, targetRole }) => {
  const checkers = await findCheckerForBranch(branchCode, targetRole)
  const assignedTo = checkers[0]?.id || null
  const diffDays = Math.floor((new Date() - new Date(submissionDate)) / (1000 * 60 * 60 * 24))

  const { data, error } = await supabase.from('edit_requests').insert({
    submission_id: submissionId,
    branch_code: branchCode,
    requested_by: requestedBy,
    request_reason: requestReason,
    submission_date: submissionDate,
    days_old: diffDays,
    required_checker: targetRole,
    assigned_to: assignedTo,
    status: 'pending',
  }).select().single()
  if (error) throw error
  return { ...data, assignedChecker: checkers[0] }
}

// আমার pending requests (checker হিসেবে)
export const getMyPendingRequests = async (checkerId, checkerRole) => {
  let query = supabase.from('edit_requests')
    .select('*, form_submissions(submission_date, data, forms(title)), requester:profiles!edit_requests_requested_by_fkey(full_name, role)')
    .order('created_at', { ascending: false })

  if (checkerRole === 'central_checker') {
    // Central Checker সব দেখে
    query = query.in('required_checker', ['regional_checker', 'divisional_checker', 'central_checker'])
  } else {
    // Regional/Divisional checker - assigned_to OR required_checker দিয়ে দেখো
    // assigned_to না থাকলেও required_checker role এর সবাই দেখতে পাবে
    query = query.eq('required_checker', checkerRole)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Branch এর নিজের requests
export const getBranchEditRequests = async (branchCode) => {
  const { data, error } = await supabase.from('edit_requests')
    .select('*, form_submissions(submission_date, forms(title)), reviewer:profiles!edit_requests_reviewed_by_fkey(full_name)')
    .eq('branch_code', branchCode)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Regional Manager এর request list (নিজে পাঠানো + পাওয়া)
export const getRegionalRequests = async (managerId, branchCodes) => {
  const { data, error } = await supabase.from('edit_requests')
    .select('*, form_submissions(submission_date, forms(title)), requester:profiles!edit_requests_requested_by_fkey(full_name, role), reviewer:profiles!edit_requests_reviewed_by_fkey(full_name)')
    .in('branch_code', branchCodes)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Approve করো
export const approveEditRequest = async (requestId, reviewerId) => {
  const { data, error } = await supabase.from('edit_requests')
    .update({ status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', requestId).select().single()
  if (error) throw error

  // Submission কে edit_allowed করো
  await supabase.from('form_submissions')
    .update({ status: 'edit_allowed' })
    .eq('id', data.submission_id)

  return data
}

// Reject করো
export const rejectEditRequest = async (requestId, reviewerId, reason) => {
  const { data, error } = await supabase.from('edit_requests')
    .update({ status: 'rejected', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), reject_reason: reason })
    .eq('id', requestId).select().single()
  if (error) throw error
  return data
}

// Branch এর কোনো submission এ active edit permission আছে কিনা
export const checkEditPermission = async (submissionId, branchCode) => {
  const { data } = await supabase.from('edit_requests')
    .select('id, status').eq('submission_id', submissionId)
    .eq('branch_code', branchCode).eq('status', 'approved')
    .order('created_at', { ascending: false }).limit(1)
  return data?.length > 0
}