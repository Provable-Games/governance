const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

// Helper function to convert hex back to decimal string
export function hexToDecimal(hex: string): string {
  return BigInt(hex).toString();
}

// Helper function to fetch from custom REST API
async function fetchAPI<T = any>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(endpoint, API_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

// Governance Queries

export async function getProposals() {
  return fetchAPI<
    Array<{
      event_id: string;
      proposal_id: string;
      proposer: string;
      vote_start: number;
      vote_end: number;
      description: string;
      proposal_id_hex: string;
      proposer_hex: string;
    }>
  >("/api/governance/proposals");
}

export async function getProposalById(proposalId: string) {
  return fetchAPI<{
    event_id: string;
    proposal_id: string;
    proposer: string;
    vote_start: number;
    vote_end: number;
    description: string;
    proposal_id_hex: string;
    proposer_hex: string;
  }>(`/api/governance/proposals/${proposalId}`);
}

export async function getProposalCalls(proposalId: string) {
  return fetchAPI<
    Array<{
      proposal_id: string;
      call_index: number;
      to_address: string;
      selector: string;
      calldata: string[];
      proposal_id_hex: string;
      to_address_hex: string;
      selector_hex: string;
    }>
  >(`/api/governance/proposals/${proposalId}/calls`);
}

export async function getVotesForProposal(proposalId: string) {
  return fetchAPI<
    Array<{
      event_id: string;
      proposal_id: string;
      voter: string;
      support: number;
      weight: string;
      reason: string;
      params: string[] | null;
      weight_sortable: string;
      proposal_id_hex: string;
      voter_hex: string;
    }>
  >(`/api/governance/proposals/${proposalId}/votes`);
}

export async function getProposalQueued(proposalId: string) {
  try {
    return await fetchAPI<{
      event_id: string;
      proposal_id: string;
      eta_seconds: string;
      proposal_id_hex: string;
    }>(`/api/governance/proposals/${proposalId}/queued`);
  } catch (error) {
    // Return null if proposal hasn't been queued (404)
    return null;
  }
}

export async function getProposalExecuted(proposalId: string) {
  try {
    return await fetchAPI<{
      event_id: string;
      proposal_id: string;
      proposal_id_hex: string;
    }>(`/api/governance/proposals/${proposalId}/executed`);
  } catch (error) {
    // Return null if proposal hasn't been executed (404)
    return null;
  }
}

export async function getProposalCanceled(proposalId: string) {
  try {
    return await fetchAPI<{
      event_id: string;
      proposal_id: string;
      proposal_id_hex: string;
    }>(`/api/governance/proposals/${proposalId}/canceled`);
  } catch (error) {
    // Return null if proposal hasn't been canceled (404)
    return null;
  }
}

export async function getVotesByVoter(voterAddress: string) {
  return fetchAPI<
    Array<{
      event_id: string;
      proposal_id: string;
      voter: string;
      support: number;
      weight: string;
      reason: string;
      params: string[] | null;
      weight_sortable: string;
      proposal_id_hex: string;
      voter_hex: string;
    }>
  >(`/api/governance/votes/address/${voterAddress}`);
}

export async function getCurrentDelegations() {
  // Note: This would return all delegations - not currently needed
  // Individual delegations can be fetched by address
  return [];
}

export async function getDelegationByAddress(address: string) {
  const result = await fetchAPI<{
    delegator: string;
    current_delegate: string | null;
    delegator_hex: string;
    current_delegate_hex: string | null;
  }>(`/api/governance/delegations/${address}`);

  // Map to old format for backwards compatibility
  return {
    delegator: result.delegator,
    delegate: result.current_delegate,
    last_updated: null,
  };
}

export async function getTopDelegates(limit: number = 10, offset: number = 0, minVotes: string = "1000000000000000000") {
  // The custom API returns all delegates sorted by current_votes desc
  // We'll filter client-side for now
  const allDelegates = await fetchAPI<
    Array<{
      delegate: string;
      current_votes: string;
      delegate_hex: string;
    }>
  >("/api/governance/delegates");

  // Filter by minVotes and apply pagination
  // Convert hex votes to decimal for comparison
  const filtered = allDelegates.filter(d => {
    // current_votes is in hex format: 0x0000...
    const votesDecimal = BigInt(d.current_votes);
    return votesDecimal >= BigInt(minVotes);
  });

  // Map to include votes field for backwards compatibility
  return filtered.slice(offset, offset + limit).map(d => ({
    ...d,
    votes: BigInt(d.current_votes).toString(), // Convert hex to decimal string
    last_updated: null, // Not available in new schema
  }));
}

export async function getDelegateVotingPower(delegateAddress: string) {
  const result = await fetchAPI<{
    delegate: string;
    current_votes: string;
    delegate_hex: string;
  }>(`/api/governance/delegates/${delegateAddress}`);

  // Map to old format for backwards compatibility
  return {
    delegate: result.delegate,
    votes: BigInt(result.current_votes).toString(), // Convert hex to decimal string
    last_updated: null,
  };
}

export async function getTotalDelegatedVotes() {
  const result = await fetchAPI<{
    total_votes: string;
  }>("/api/governance/stats/total-votes");

  return result.total_votes;
}
