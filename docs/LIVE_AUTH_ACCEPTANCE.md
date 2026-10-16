# Live OAuth acceptance

17 October 2026, https://veyra-forensics.vercel.app.

Method: browser interaction with the real configured Google and GitHub providers, followed by read-only aggregate SQL inspection of the hosted Neon database. The user approved provider access and permanent deletion of the synthetic test record. No provider, database or session credential appears in this record.

| Check                      | Observed result                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub first authorization | Public data only; returned to the authenticated conversation import view                                                                    |
| Google first authorization | Basic profile/email; authenticated profile and separate workspace appeared                                                                  |
| Returning login            | Both providers returned to their existing workspaces; one account per provider remained in the database                                     |
| Profile and persistence    | Both supplied profile images appeared; sign-in survived page refresh                                                                        |
| GitHub private storage     | A new four-message fictional Harbor workshop conversation was analyzed locally, saved, listed, renamed, reopened and restored after refresh |
| Ownership                  | Google's empty history did not list GitHub's record; opening its known ID returned “Investigation not found” without transcript content     |
| Deletion                   | The user-approved synthetic record was deleted, remained absent after refresh, and aggregate SQL reported zero investigations               |
| Logout                     | Returned to login; private navigation required sign-in again                                                                                |
| Database state             | Two distinct provider users; one linked account per provider; provider access/refresh/ID tokens absent; session tokens hashed and unexpired |
| URL behavior               | Internal views retained the canonical root address; provider authorization used its required external/callback URLs                         |

Final deployment: `dpl_3q8nfNaUoNXmT48FKTsm4F2tZ5Ny`. The signed-in session survived deployment. A fresh four-message guest report was recovered through real Google OAuth on this release, displaying “MESSAGE 4” and “4 / 4.” The save checkbox remained unselected and the save button disabled until explicit consent. Clearing the temporary report left private history empty.

An earlier consent request expired while waiting for approval. Its security check was rejected and a fresh sign-in succeeded. The generic error copy now suggests retrying instead of incorrectly attributing every library configuration error to missing setup.

Reopening the synthetic report exposed an initial replay label of 60 for a four-message exchange. Replay now initializes from the restored analysis message count. Regression checks assert the correct replay position on reopen and refresh. All 14 authentication/product browser tests passed after these fixes; their provider responses are mocks and remain distinct from the live observations above.

Provider cancellation, simulated provider failure, expired sessions, invalid redirects and cross-user mutation are covered by automated tests. No live provider outage or unauthorized destructive request was induced. These checks do not establish availability for every provider account, human usability or screen-reader compatibility. Google and GitHub workspaces remain separate because automatic account linking is intentionally disabled.
