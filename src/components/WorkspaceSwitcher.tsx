import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Layers, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useListWorkspaces, listWorkspacesQueryKey } from '@/api/generated/hooks/workspacesHooks/useListWorkspaces';
import { useCreateWorkspace } from '@/api/generated/hooks/workspacesHooks/useCreateWorkspace';
import { useWorkspace } from '@/lib/workspace';
import { useAuth } from '@/lib/auth';
import { canCreateWorkspace } from '@/lib/roles';
import { apiErrorMessage } from '@/lib/api-errors';

/**
 * Same Popover-list idiom as `LanguageSwitcher` — no dropdown-menu primitive
 * exists in `components/ui` yet, and this isn't the place to introduce one.
 *
 * Shown with a single workspace too, unlike before: the plans sell "up to N
 * companies or brands", and hiding the control until a second one existed left
 * the only way to create one unreachable. A still-loading list (`data`
 * undefined) renders nothing rather than a flash of an empty menu.
 */
export function WorkspaceSwitcher({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { workspaceId, setWorkspaceId } = useWorkspace();
  const { data } = useListWorkspaces();
  const workspaces = data?.workspaces ?? [];

  const mayCreate = canCreateWorkspace(role);

  const create = useCreateWorkspace({
    mutation: {
      onMutate: () => setError(null),
      onSuccess: async (created) => {
        setName('');
        setAdding(false);
        await queryClient.invalidateQueries({ queryKey: listWorkspacesQueryKey() });
        // Straight into what was just created: creating a brand and staying in
        // the old one is a click nobody meant to make.
        setWorkspaceId(created.id);
        setOpen(false);
      },
      // The backend's own words when it refused — the plan-cap message names the
      // current count and the ceiling, which generic copy cannot.
      onError: (err) => setError(apiErrorMessage(err, t('app.workspace.createFailed'))),
    },
  });

  if (workspaces.length === 0) return null;

  // Nothing picked yet reflects the backend's own fallback: the oldest
  // membership, which is the first row here (the list is ordered the same
  // way).
  const active = workspaces.find((w) => w.id === workspaceId) ?? workspaces[0];

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // A half-typed name and a refusal do not survive the panel closing:
        // reopening should not resume an attempt the user walked away from.
        if (!next) {
          setAdding(false);
          setError(null);
        }
      }}
    >
      <PopoverTrigger
        aria-label={t('app.workspace.switch')}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          tone === 'dark'
            ? 'border-white/15 text-white/80 hover:bg-white/5'
            : 'border-border text-foreground hover:bg-accent',
        )}
      >
        <Layers className="size-4 opacity-70" />
        <span className="max-w-[9rem] truncate">{active?.name}</span>
        <ChevronDown className={cn('size-3.5 opacity-60 transition-transform', open && 'rotate-180')} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        {workspaces.map((ws) => {
          const isActive = ws.id === active?.id;
          return (
            <button
              key={ws.id}
              type="button"
              onClick={() => {
                setWorkspaceId(ws.id);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                isActive ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-accent',
              )}
            >
              <span className="flex-1 truncate text-left">{ws.name}</span>
              {isActive && <Check className="size-4 text-primary" />}
            </button>
          );
        })}

        {mayCreate && (
          <div className="mt-1 border-t pt-1">
            {adding ? (
              <form
                className="space-y-2 p-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  create.mutate({ data: { name: name.trim() } });
                }}
              >
                <label htmlFor="workspace-name" className="text-xs font-medium text-muted-foreground">
                  {t('app.workspace.nameLabel')}
                </label>
                <input
                  id="workspace-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {error && (
                  <p className="text-xs text-destructive">
                    {error}{' '}
                    <Link to="/app/settings/billing" className="underline" onClick={() => setOpen(false)}>
                      {t('app.workspace.capCta')}
                    </Link>
                  </p>
                )}
                <Button type="submit" size="sm" className="w-full" disabled={create.isPending || name.trim() === ''}>
                  {create.isPending ? t('common.saving') : t('app.workspace.createBtn')}
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="size-4" aria-hidden />
                <span className="flex-1 truncate text-left">{t('app.workspace.create')}</span>
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
