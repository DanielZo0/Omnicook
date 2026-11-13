"use client";
import { useEffect, useRef, useState } from "react";
import {
  socialApi,
  type CommunityState,
  type SharedRecipe,
} from "@/lib/social/client";
import { RecipeImage } from "../RecipeImage";
import { SocialDialog } from "./SharingDialog";
import { ActivityPhoto } from "./ActivityPhoto";
import { SharedRecipeView } from "./SharedRecipeView";
type Book = {
  id: string;
  name: string;
  ownerId: string;
  role: string;
  recipes: SharedRecipe[];
  hasMore: boolean;
  members: { user_id: string; name: string; role: string }[];
  invites: {
    id: string;
    email: string | null;
    role: string;
    expires_at: string;
  }[];
  activity: {
    id: string;
    kind: string;
    title: string;
    name: string;
    created_at: string;
    has_photo: boolean;
    is_mine: boolean;
  }[];
};
type Feed = {
  recipes: SharedRecipe[];
  profile: { user_id: string; display_name: string; bio: string } | null;
  hasMore: boolean;
};
export function Community({
  signedIn,
  active = true,
  onAccount,
  onSaved,
  initialProfile = false,
  profileRequest = 0,
  onCookingChange,
}: {
  signedIn: boolean;
  active?: boolean;
  onAccount: () => void;
  onSaved: (id: string) => void;
  initialProfile?: boolean;
  profileRequest?: number;
  onCookingChange?: (active: boolean) => void;
}) {
  const [state, setState] = useState<CommunityState | null>(null),
    [tab, setTab] = useState<"family" | "discover" | "profile">(
      initialProfile ? "profile" : "family",
    ),
    [bookId, setBookId] = useState(""),
    [book, setBook] = useState<Book | null>(null),
    [feed, setFeed] = useState<Feed | null>(null),
    [profileId, setProfileId] = useState<string | undefined>(),
    [following, setFollowing] = useState(false),
    [offset, setOffset] = useState(0),
    [bookOffset, setBookOffset] = useState(0),
    [filters, setFilters] = useState<{
      query?: string;
      cuisine?: string;
      maxMinutes?: number;
    }>({}),
    [bookTab, setBookTab] = useState("Recipes"),
    [recipe, setRecipe] = useState<SharedRecipe | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState<
      "create" | "people" | "profile" | "reports" | null
    >(null),
    [invite, setInvite] = useState(""),
    [reports, setReports] = useState<any[]>([]);
  useEffect(()=>{
    if(initialProfile){setTab('profile');setProfileId(undefined);setOffset(0);setRecipe(null);}
  },[profileRequest]);
  const request = useRef(0),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current++;
    };
  }, []);
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision((n) => n + 1);
  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    socialApi<CommunityState>()
      .then((s) => {
        if (current) {
          setState(s);
          setBookId((id) =>
            s.cookbooks.some((b) => b.id === id)
              ? id
              : s.cookbooks[0]?.id || "",
          );
        }
      })
      .catch((e) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [signedIn, revision]);
  useEffect(() => {
    if (!state) return;
    const n = ++request.current;
    setError("");
    setRecipe(null);
    if (tab === "family") {
      setBook(null);
      if (bookId)
        socialApi<Book>("cookbook", { id: bookId, offset: bookOffset })
          .then((b) => {
            if (n === request.current) setBook(b);
          })
          .catch((e) => n === request.current && setError(e.message));
    } else {
      setFeed(null);
      socialApi<Feed>("feed", {
        tab:
          tab === "profile" ? "profile" : following ? "following" : "discover",
        userId: tab === "profile" ? profileId : undefined,
        offset,
        ...(tab === "discover" ? filters : {}),
      })
        .then((f) => {
          if (n === request.current) setFeed(f);
        })
        .catch((e) => n === request.current && setError(e.message));
    }
    return () => {
      request.current++;
    };
  }, [
    state,
    tab,
    bookId,
    profileId,
    following,
    offset,
    bookOffset,
    filters,
    revision,
  ]);
  async function mutate(
    op: string,
    input: unknown,
    done?: (result: any) => void,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await socialApi(op, input);
      if (alive.current) {
        done?.(result);
        reload();
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function open(r: SharedRecipe) {
    setBusy(true);
    setError("");
    try {
      const result = await socialApi<SharedRecipe>("recipe", {
        recipeId: r.id,
        cookbookId: tab === "family" ? bookId : undefined,
      });
      if (alive.current) setRecipe(result);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function profile(id: string) {
    setProfileId(id);
    setTab("profile");
    setOffset(0);
    setRecipe(null);
  }
  async function queue() {
    setError("");
    try {
      const q = await socialApi(
        "reports",
        tab === "family" ? { cookbookId: bookId } : {},
      );
      setReports(q.reports);
      setDialog("reports");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!signedIn)
    return (
      <section className="community-screen">
        <h1>A seat at the table</h1>
        <p>
          Share family favourites, keep a cookbook together and discover
          something new.
        </p>
        <a className="primary-button" href="/login">
          Sign in to join the community
        </a>
        <button onClick={onAccount}>My kitchen</button>
      </section>
    );
  if (recipe)
    return (
      <div className="community-screen">
        {error && <p role="alert">{error}</p>}
        <SharedRecipeView active={active}
          onCookingChange={onCookingChange}
          key={recipe.id}
          recipe={recipe}
          cookbookId={tab === "family" ? bookId : undefined}
          userId={state?.publicId}
          onBack={() => {
            setRecipe(null);
            reload();
          }}
          onSaved={onSaved}
          onRefresh={async () => {
            if (!alive.current) return;
            const updated = await socialApi<SharedRecipe>("recipe", {
              recipeId: recipe.id,
              cookbookId: tab === "family" ? bookId : undefined,
            });
            if (alive.current) setRecipe(updated);
          }}
          onAuthor={profile}
        />
      </div>
    );
  const mine = !profileId || profileId === state?.publicId;
  return (
    <section className="community-screen">
      <header className="community-heading">
        <div>
          <p className="social-eyebrow">Recipes bring us together</p>
          <h1>Our kitchens</h1>
        </div>
        <button
          className="avatar"
          aria-label="My kitchen and account"
          onClick={onAccount}
        >
          Me
        </button>
      </header>
      <nav className="community-tabs" aria-label="Community">
        <button
          aria-current={tab === "family" ? "page" : undefined}
          onClick={() => {
            setTab("family");
            setOffset(0);
          }}
        >
          Family
        </button>
        <button
          aria-current={tab === "discover" ? "page" : undefined}
          onClick={() => {
            setTab("discover");
            setOffset(0);
          }}
        >
          Discover
        </button>
        <button
          aria-current={tab === "profile" && mine ? "page" : undefined}
          onClick={() => {
            setTab("profile");
            setProfileId(undefined);
            setOffset(0);
          }}
        >
          My feed
        </button>
      </nav>
      {error && (
        <p className="social-notice" role="alert">
          {error}
        </p>
      )}
      {!state && !error && <p role="status">Opening your kitchens…</p>}
      {state && tab === "family" && (
        <>
          <div className="family-heading">
            <div>
              <label>
                Shared cookbook
                <select
                  aria-label="Shared cookbook"
                  value={bookId}
                  onChange={(e) => {
                    setBookId(e.target.value);
                    setBookOffset(0);
                    setBookTab("Recipes");
                    setInvite("");
                  }}
                >
                  {!state.cookbooks.length && (
                    <option value="">No cookbooks yet</option>
                  )}
                  {state.cookbooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button onClick={() => setDialog("create")}>+ New cookbook</button>
          </div>
          {book && (
            <>
              <div className="social-inline">
                <nav className="social-subtabs" aria-label="Cookbook view">
                  {["Recipes", "Activity"].map((t) => (
                    <button
                      key={t}
                      aria-pressed={bookTab === t}
                      onClick={() => setBookTab(t)}
                    >
                      {t}
                    </button>
                  ))}
                </nav>
                <button onClick={() => setDialog("people")}>
                  People & access
                </button>
              </div>
              {bookTab === "Recipes" ? (
                book.recipes.length ? (
                  <>
                    <Cards
                      recipes={book.recipes}
                      onOpen={open}
                      onAuthor={profile}
                    />
                    <div className="social-inline">
                      {bookOffset > 0 && (
                        <button
                          onClick={() =>
                            setBookOffset(Math.max(0, bookOffset - 20))
                          }
                        >
                          Previous recipes
                        </button>
                      )}
                      {book.hasMore && (
                        <button onClick={() => setBookOffset(bookOffset + 20)}>
                          More recipes
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="social-empty">
                    <h2>Every family has a favourite</h2>
                    <p>
                      Open a recipe in your cookbook and choose Share to add it
                      here.
                    </p>
                  </div>
                )
              ) : (
                <div className="social-activity">
                  {book.activity.length ? (
                    book.activity.map((a) => (
                      <article key={a.id}>
                        <b>{a.name}</b>{" "}
                        {a.kind === "cooked"
                          ? "cooked"
                          : a.kind === "alternative"
                            ? "suggested an alternative for"
                            : "shared"}{" "}
                        <b>{a.title}</b>
                        <small>
                          {new Date(a.created_at).toLocaleDateString()}
                        </small>
                        <button
                          disabled={busy}
                          onClick={() =>
                            mutate("report", {
                              kind: "activity",
                              targetId: a.id,
                              cookbookId: bookId,
                              reason: "Abuse",
                              details: "",
                            })
                          }
                        >
                          Report activity
                        </button>
                      </article>
                    ))
                  ) : (
                    <p>
                      Shared recipes, alternatives and cooked dishes will appear
                      here.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          {!state.cookbooks.length && (
            <div className="social-empty">
              <h2>Your family recipe book starts here</h2>
              <p>
                Create a private cookbook and invite the people you cook with.
              </p>
              <button
                className="primary-button"
                onClick={() => setDialog("create")}
              >
                Create a cookbook
              </button>
            </div>
          )}
        </>
      )}
      {state && tab !== "family" && (
        <>
          {tab === "discover" ? (
            <div className="social-inline">
              <div>
                <h2>Something new for your table</h2>
                <p>Recipes shared publicly by home cooks.</p>
              </div>
              <button
                aria-pressed={following}
                onClick={() => {
                  setFollowing(!following);
                  setOffset(0);
                }}
              >
                {following ? "Following" : "All cooks"}
              </button>
            </div>
          ) : (
            <header className="public-profile">
              <div className="profile-avatar">
                {(
                  feed?.profile?.display_name ||
                  state.profile?.display_name ||
                  "Cook"
                ).slice(0, 1)}
              </div>
              <div>
                <p className="social-eyebrow">Public kitchen</p>
                <h2>
                  {feed?.profile?.display_name ||
                    (mine ? state.profile?.display_name : "") ||
                    "A home cook"}
                </h2>
                <p>{feed?.profile?.bio || (mine ? state.profile?.bio : "")}</p>
                <small>Only recipes published to Discover appear here.</small>
                {(mine ? state.profile?.public_id : profileId) && (
                  <p>
                    <a
                      href={`/cooks/${mine ? state.profile?.public_id : profileId}`}
                    >
                      Open public profile ↗
                    </a>
                  </p>
                )}
                {!mine && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      mutate("report", {
                        kind: "profile",
                        targetId: profileId,
                        reason: "Abuse",
                        details: "",
                      })
                    }
                  >
                    Report profile
                  </button>
                )}
              </div>
              {mine ? (
                <button onClick={() => setDialog("profile")}>
                  Edit profile
                </button>
              ) : (
                <button
                  disabled={busy}
                  onClick={() =>
                    mutate("follow", {
                      userId: profileId,
                      enabled: !state.following.some((x) => x.id === profileId),
                    })
                  }
                >
                  {state.following.some((x) => x.id === profileId)
                    ? "Following"
                    : "Follow"}
                </button>
              )}
            </header>
          )}
          {tab === "discover" && (
            <form
              className="discover-filters"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setFilters({
                  query: String(f.get("query") || "") || undefined,
                  cuisine: String(f.get("cuisine") || "") || undefined,
                  maxMinutes: Number(f.get("minutes")) || undefined,
                });
                setOffset(0);
              }}
            >
              <label>
                Recipe or ingredient
                <input
                  name="query"
                  maxLength={120}
                  placeholder="Try rice, pasta, chickpeas…"
                />
              </label>
              <label>
                Cuisine
                <input
                  name="cuisine"
                  maxLength={60}
                  placeholder="Any cuisine"
                />
              </label>
              <label>
                Time
                <select name="minutes">
                  <option value="">Any time</option>
                  <option value="30">Under 30 min</option>
                  <option value="60">Under 1 hour</option>
                </select>
              </label>
              <button>Find recipes</button>
            </form>
          )}
          {!feed && !error && <p role="status">Gathering recipes…</p>}
          {feed && (
            <>
              {feed.recipes.length ? (
                <Cards
                  recipes={feed.recipes}
                  onOpen={open}
                  onAuthor={profile}
                  onReact={(r) =>
                    mutate("react", { recipeId: r.id, enabled: !r.liked })
                  }
                />
              ) : (
                <div className="social-empty">
                  <h2>
                    {tab === "profile"
                      ? "A little quiet in this kitchen"
                      : "Fresh inspiration is on its way"}
                  </h2>
                  <p>
                    {mine && tab === "profile"
                      ? "Share a recipe to Discover and it will appear on your public profile."
                      : "Publicly shared recipes will appear here."}
                  </p>
                </div>
              )}
              <div className="social-inline">
                {offset > 0 && (
                  <button onClick={() => setOffset(Math.max(0, offset - 20))}>
                    Previous recipes
                  </button>
                )}
                {feed.hasMore && (
                  <button onClick={() => setOffset(offset + 20)}>
                    More recipes
                  </button>
                )}
              </div>
            </>
          )}
          {state.isModerator && (
            <button onClick={queue}>Public moderation queue</button>
          )}
        </>
      )}
      {dialog === "create" && (
        <SocialDialog
          notice={error}
          title="Start a shared cookbook"
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutate(
                "createCookbook",
                { name: new FormData(e.currentTarget).get("name") },
                (b) => {
                  setBookId(b.id);
                  setDialog(null);
                  setTab("family");
                },
              );
            }}
          >
            <label>
              Cookbook name
              <input
                name="name"
                required
                maxLength={60}
                placeholder="Our family table"
              />
            </label>
            <p>
              Invite-only. Contributors keep control of their original recipes.
            </p>
            <button className="primary-button" disabled={busy}>
              Create cookbook
            </button>
          </form>
        </SocialDialog>
      )}
      {dialog === "profile" && (
        <SocialDialog
          title="Your public cook profile"
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              mutate(
                "profile",
                { name: f.get("name"), bio: f.get("bio") },
                () => setDialog(null),
              );
            }}
          >
            <label>
              Display name
              <input
                name="name"
                required
                maxLength={60}
                defaultValue={state?.profile?.display_name}
              />
            </label>
            <label>
              A little about your kitchen
              <textarea
                name="bio"
                maxLength={240}
                defaultValue={state?.profile?.bio}
              />
            </label>
            <p>
              Your name, bio and Discover recipes are public. Private cookbook
              names stay private.
            </p>
            <button className="primary-button" disabled={busy}>
              Save profile
            </button>
          </form>
          <details>
            <summary>Blocked cooks</summary>
            {state?.blocks.map((b) => (
              <div key={b.id}>
                <span>Blocked cook</span>
                <button
                  disabled={busy}
                  onClick={() =>
                    mutate("block", { userId: b.id, enabled: false })
                  }
                >
                  Unblock
                </button>
              </div>
            ))}
          </details>
        </SocialDialog>
      )}
      {dialog === "people" && book && (
        <SocialDialog
          title="People & access"
          onClose={() => {
            setDialog(null);
            setInvite("");
          }}
        >
          <h3>{book.name}</h3>
          {book.members.map((m) => (
            <div className="social-member" key={m.user_id}>
              <div>
                <b>{m.name}</b>
                <small>
                  {m.user_id === book.ownerId ? "Owner" : m.role}
                  {m.user_id === state?.userId ? " · You" : ""}
                </small>
              </div>
              {book.role === "Administrator" && m.user_id !== book.ownerId && (
                <details>
                  <summary>Options</summary>
                  <button
                    disabled={busy}
                    onClick={() =>
                      mutate("member", {
                        id: book.id,
                        userId: m.user_id,
                        action:
                          m.role === "Administrator"
                            ? "member"
                            : "administrator",
                      })
                    }
                  >
                    {m.role === "Administrator"
                      ? "Make member"
                      : "Make administrator"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          `Remove ${m.name} and their recipe contributions from this cookbook?`,
                        )
                      )
                        mutate("member", {
                          id: book.id,
                          userId: m.user_id,
                          action: "remove",
                        });
                    }}
                  >
                    Remove member
                  </button>
                  {book.ownerId === state?.userId && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(`Transfer cookbook ownership to ${m.name}?`)
                        )
                          mutate("member", {
                            id: book.id,
                            userId: m.user_id,
                            action: "transfer",
                          });
                      }}
                    >
                      Transfer ownership
                    </button>
                  )}
                </details>
              )}
            </div>
          ))}
          {book.role === "Administrator" && (
            <>
              <h3>Invite someone</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  mutate(
                    "invite",
                    {
                      id: book.id,
                      email: String(f.get("email") || "") || null,
                      role: f.get("role"),
                    },
                    (i) => setInvite(window.location.origin + i.path),
                  );
                }}
              >
                <label>
                  Email (optional)
                  <input name="email" type="email" maxLength={254} />
                </label>
                <label>
                  Role
                  <select name="role">
                    <option>Member</option>
                    <option>Administrator</option>
                  </select>
                </label>
                <p>
                  A single-use link expires after seven days. Add an email to
                  require that verified account.
                </p>
                <button disabled={busy}>Create invitation link</button>
              </form>
              {invite && (
                <label>
                  Copy and send this invitation
                  <input
                    readOnly
                    value={invite}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={() =>
                      navigator.clipboard
                        .writeText(invite)
                        .catch(() =>
                          setError("Select and copy the invitation above."),
                        )
                    }
                  >
                    Copy invitation
                  </button>
                </label>
              )}
              <h3>Pending invitations</h3>
              {book.invites.map((i) => (
                <div className="social-member" key={i.id}>
                  <div>
                    {i.email || "Anyone with this invitation"}
                    <small>
                      {i.role} · Expires{" "}
                      {new Date(i.expires_at).toLocaleDateString()}
                    </small>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() =>
                      mutate("revokeInvite", { id: book.id, inviteId: i.id })
                    }
                  >
                    Revoke
                  </button>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  mutate("renameCookbook", {
                    id: book.id,
                    name: new FormData(e.currentTarget).get("name"),
                  });
                }}
              >
                <label>
                  Cookbook name
                  <input
                    name="name"
                    required
                    maxLength={60}
                    defaultValue={book.name}
                  />
                </label>
                <button disabled={busy}>Rename cookbook</button>
              </form>
              <button onClick={queue}>Review cookbook reports</button>
            </>
          )}
          {book.ownerId === state?.userId ? (
            <button
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Archive this cookbook and revoke all invitations and shared access? Your own recipes remain in your cookbook.",
                  )
                )
                  mutate("archiveCookbook", { id: book.id }, () =>
                    setDialog(null),
                  );
              }}
            >
              Archive cookbook
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Leave this cookbook? Your shared contributions will be removed.",
                  )
                )
                  mutate("leave", { id: book.id }, () => setDialog(null));
              }}
            >
              Leave cookbook
            </button>
          )}
        </SocialDialog>
      )}
      {dialog === "reports" && (
        <SocialDialog title="Content reports" onClose={() => setDialog(null)}>
          {reports.length ? (
            reports.map((r) => (
              <article key={r.id}>
                <b>
                  {r.reason} · {r.target_kind}
                </b>
                <p>{r.details || "No additional details"}</p>
                <details>
                  <summary>Review reported content</summary>
                  {r.content?.imageUrl && (
                    <RecipeImage
                      className="activity-photo"
                      src={r.content.imageUrl}
                      alt="Reported contribution"
                    />
                  )}
                  <pre className="reported-content">
                    {r.content
                      ? JSON.stringify(r.content, null, 2)
                      : "Content already unavailable"}
                  </pre>
                </details>
                <div className="social-inline">
                  <button
                    disabled={busy}
                    onClick={() =>
                      mutate("resolve", { id: r.id, action: "dismiss" }, () =>
                        setReports((x) => x.filter((y) => y.id !== r.id)),
                      )
                    }
                  >
                    Dismiss
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      mutate("resolve", { id: r.id, action: "remove" }, () =>
                        setReports((x) => x.filter((y) => y.id !== r.id)),
                      )
                    }
                  >
                    Remove from shared space
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p>No open reports.</p>
          )}
        </SocialDialog>
      )}
    </section>
  );
}
function Cards({
  recipes,
  onOpen,
  onAuthor,
  onReact,
}: {
  recipes: SharedRecipe[];
  onOpen: (r: SharedRecipe) => void;
  onAuthor: (id: string) => void;
  onReact?: (r: SharedRecipe) => void;
}) {
  return (
    <div className="community-cards">
      {recipes.map((r) => (
        <article key={r.id}>
          <button className="community-card-open" onClick={() => onOpen(r)}>
            <div className="community-card-photo">
              <RecipeImage
                src={r.imageUrl || undefined}
                alt={r.title}
                loading="lazy"
              />
              {r.photoMetadata?.kind === "generated" && (
                <small>AI illustration</small>
              )}
            </div>
            <h3>{r.title}</h3>
          </button>
          <button
            className="author-button"
            disabled={!r.author.id}
            onClick={() => onAuthor(r.author.id)}
          >
            From {r.author.name}’s kitchen
          </button>
          <p>
            {(r.prepMinutes || 0) + (r.cookMinutes || 0)} min · {r.category}
          </p>
          {onReact && (
            <button
              className="social-reaction"
              aria-pressed={!!r.liked}
              aria-label={`Like ${r.title}`}
              onClick={() => onReact(r)}
            >
              {r.liked ? "♥" : "♡"} {r.likes || 0}
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
