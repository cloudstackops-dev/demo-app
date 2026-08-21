# Demo CI/CD Project

A minimal Node.js (Express) app with a Jenkins pipeline that builds, tags,
pushes to DigitalOcean Container Registry (DOCR), and deploys to a single
`demo` namespace on DigitalOcean Kubernetes (DOKS).

Scope is intentionally narrow: everything lives in the `demo` namespace, no
other namespaces or cluster-scoped resources are touched, and the app relies
on a cluster-wide nginx ingress controller that is assumed to already be
installed.

## File tree

```
project-demo/
├── app/
│   ├── package.json
│   ├── server.js
│   └── .dockerignore
├── Dockerfile
├── Jenkinsfile
├── k8s/
│   ├── 00-namespace.yaml
│   ├── 01-docr-secret.yaml
│   ├── 02-deployment.yaml
│   ├── 03-service.yaml
│   └── 04-ingress.yaml
└── README.md
```

## Registry and cluster (already set for this environment)

- DOCR registry: `demo-registry-cnl` → `registry.digitalocean.com/demo-registry-cnl`
- DOKS cluster context: `do-fra1-supra-prod-cluster`
- Ingress host: `demo.209.38.188.54.nip.io` (DOKS ingress-nginx LoadBalancer IP)

## One-time manual steps

Done already:
- ✅ `demo` namespace exists on the cluster.
- ✅ `docr-registry-secret` (dockerconfigjson) created in `demo`, generated via
  `doctl registry kubernetes-manifest demo-registry-cnl --namespace demo --name docr-registry-secret`.
- ✅ `k8s/02-deployment.yaml` image field and `Jenkinsfile` `REGISTRY` updated
  to `demo-registry-cnl`.
- ✅ `k8s/04-ingress.yaml` host set to `demo.209.38.188.54.nip.io`.

Still required from you:

1. **Add two Jenkins credentials** (IDs must match the `Jenkinsfile` exactly):
   - `docr-credentials` — Username/Password credential. Use your DOCR API
     token as *both* the username and password value — for `docker login`.
   - `doks-kubeconfig` — Secret file credential containing the kubeconfig for
     `do-fra1-supra-prod-cluster` (`doctl kubernetes cluster kubeconfig save <cluster-id>`
     then upload the resulting file) — for `kubectl` access during Deploy.

2. **Apply the Deployment, Service, and Ingress once manually**, so the
   pipeline's `kubectl set image` has an existing Deployment to update:
   ```
   kubectl apply -f k8s/02-deployment.yaml
   kubectl apply -f k8s/03-service.yaml
   kubectl apply -f k8s/04-ingress.yaml
   ```
   Note: the Deployment's image tag is a placeholder (`REPLACE_ME`) until the
   first Jenkins run pushes a real image and updates it via `kubectl set
   image` — pods will sit in `ImagePullBackOff` until that first run
   completes. This is expected.

3. **Point a Jenkins pipeline job at this repo** (Jenkinsfile is already at
   the repo root) and trigger the first build.

After these steps, every subsequent Jenkins run builds a new image tagged
with the short git commit SHA, pushes it to DOCR, and updates the Deployment
via `kubectl set image` + `kubectl rollout status` (no `latest` tag, no
`rollout restart`).
