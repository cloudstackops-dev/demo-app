# Demo CI/CD Project

A minimal Node.js (Express) app with a Jenkins pipeline that builds, tags,
pushes to DigitalOcean Container Registry (DOCR), and deploys to a single
`demo` namespace on DigitalOcean Kubernetes (DOKS).

Scope is intentionally narrow: everything lives in the `demo` namespace, and
no cluster-scoped resource is created or modified. The app relies on the
pre-existing cluster-wide **haproxy** ingress controller and the pre-existing
**letsencrypt-haproxy** cert-manager `ClusterIssuer` — both are only
*referenced* (via `ingressClassName` and the `cert-manager.io/cluster-issuer`
annotation), never installed or reconfigured.

Note: the original spec targeted the nginx ingress controller, but this
cluster's `letsencrypt-haproxy` ClusterIssuer only solves HTTP-01 challenges
through the `haproxy` IngressClass (its DNS-01 solver needs a real
Cloudflare-managed domain, which a `nip.io` address is not). So TLS via
Let's Encrypt would require using the `haproxy` ingress class instead of
`nginx` — see the TLS status note below for why it's not enabled.

This cluster's `haproxy-ingress` controller also requires the legacy
`kubernetes.io/ingress.class: haproxy` annotation in addition to
`ingressClassName: haproxy` to actually route traffic — with only
`ingressClassName` set, requests hit the default backend (404).
`k8s/04-ingress.yaml` sets both.

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
- Ingress class: `haproxy` (existing `IngressClass`, controller `haproxy.org/ingress-controller`)
- Ingress host: `demo.209.38.114.36.nip.io` (haproxy ingress controller's LoadBalancer IP)
- TLS: **not enabled**. The `letsencrypt-haproxy` ClusterIssuer's solver list
  has no selectors, so cert-manager always tries the DNS-01/Cloudflare solver
  first — which fails permanently for a `nip.io` host ("no Zones for domain").
  Forcing HTTP-01 would require adding a selector to that shared
  ClusterIssuer, which is out of scope here. The app is served over plain
  HTTP. A leftover `Certificate/demo-app-tls` object in `demo` may still show
  `READY: False` and retry in the background — this is expected and harmless
  (delete it with `kubectl delete certificate demo-app-tls -n demo` if you
  want to stop the retries).

## One-time manual steps

Done already:
- ✅ `demo` namespace exists on the cluster.
- ✅ `docr-registry-secret` (dockerconfigjson) created in `demo`, generated via
  `doctl registry kubernetes-manifest demo-registry-cnl --namespace demo --name docr-registry-secret`.
- ✅ `k8s/02-deployment.yaml` image field and `Jenkinsfile` `REGISTRY` updated
  to `demo-registry-cnl`.
- ✅ `k8s/04-ingress.yaml` set to `ingressClassName: haproxy` +
  `kubernetes.io/ingress.class: haproxy` annotation, host
  `demo.209.38.114.36.nip.io`, plain HTTP (see TLS status note above).
- ✅ Deployment, Service, and Ingress applied to `demo`; verified live —
  `curl http://demo.209.38.114.36.nip.io/` and `/health` both return 200.

Still required from you:

1. **Add two Jenkins credentials** (IDs must match the `Jenkinsfile` exactly):
   - `docr-credentials` — Username/Password credential. Use your DOCR API
     token as *both* the username and password value — for `docker login`.
   - `doks-kubeconfig` — Secret file credential containing the kubeconfig for
     `do-fra1-supra-prod-cluster` (`doctl kubernetes cluster kubeconfig save <cluster-id>`
     then upload the resulting file) — for `kubectl` access during Deploy.

2. **Point a Jenkins pipeline job at this repo** (Jenkinsfile is already at
   the repo root) and trigger the first build.

After these steps, every subsequent Jenkins run builds a new image tagged
with the short git commit SHA, pushes it to DOCR, and updates the Deployment
via `kubectl set image` + `kubectl rollout status` (no `latest` tag, no
`rollout restart`).
