import { AppShell, DeploymentIcon, HomeIcon, ProjectsMenuItem, SideNavMenu, MindMapIcon } from '@solidvs/ui';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';

import { signOut, useSession } from '../auth/session';
import { recentIds, useCatalog } from '../data/catalog';

const MAIN = [
  { id: 'home', label: 'Início', href: '/', icon: HomeIcon },
  { id: 'deploys', label: 'Deploys', href: '/deploys', icon: DeploymentIcon },
  { id: 'stack', label: 'Arquitetura', href: '/stack', icon: MindMapIcon },
];

/** Most projects pinned in the side nav; the rest stay under "Mais projetos". */
const PINNED_LIMIT = 10;

/** The shell of every page behind sign-in: top nav, side nav with "Projetos", main area. */
export function Layout() {
  const me = useSession();
  const catalog = useCatalog() ?? [];
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const selected = MAIN.find((item) => item.href === location.pathname)?.id;
  // Projects whose repository carries the platform manifest (catalog-info.yaml) are pinned for
  // everyone, while adoption is low. Revisit when more than PINNED_LIMIT projects qualify: then the
  // rule stops selecting anything, and pinning should become per user (favorites or ownership).
  const pinned = catalog
    .filter((entry) => entry.manifest === 'repository')
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, PINNED_LIMIT)
    .map((entry) => ({ id: entry.id, name: entry.name, href: `/projetos/${entry.id}` }));
  // A pinned project is not repeated under "Recentes".
  const recent = recentIds()
    .filter((id) => !pinned.some((project) => project.id === id))
    .map((id) => catalog.find((entry) => entry.id === id))
    .filter((entry) => entry !== undefined)
    .map((entry) => ({ id: entry.id, name: entry.name, href: `/projetos/${entry.id}` }));

  return (
    <AppShell
      userName={me.user.name}
      sideNav={
        <>
          <SideNavMenu sections={[{ id: 'main', items: MAIN }]} {...(selected ? { selectedId: selected } : {})} navigate={navigate} />
          <ProjectsMenuItem
            href="/projetos"
            starred={pinned}
            starredLabel="Na plataforma"
            recent={recent}
            {...(projectId ? { selectedProjectId: projectId } : {})}
            navigate={navigate}
          />
        </>
      }
      sideNavFooter={
        <SideNavMenu
          sections={[{ id: 'account', items: [{ id: 'sign-out', label: 'Sair', href: '/' }] }]}
          navigate={() => {
            void signOut();
          }}
        />
      }
    >
      <Outlet />
    </AppShell>
  );
}
