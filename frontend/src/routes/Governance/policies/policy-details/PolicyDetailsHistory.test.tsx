/* Copyright Contributors to the Open Cluster Management project */
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import { policiesState } from '../../../../atoms'
import { waitForText } from '../../../../lib/test-util'
import { Policy } from '../../../../resources'
import { PolicyDetailsHistory } from './PolicyDetailsHistory'

const rootPolicy: Policy = {
    apiVersion: 'policy.open-cluster-management.io/v1',
    kind: 'Policy',
    metadata: {
        name: 'policy-set-with-1-placement-policy',
        namespace: 'test',
    },
    spec: {
        disabled: false,
        'policy-templates': [
            {
                objectDefinition: {
                    apiVersion: 'policy.open-cluster-management.io/v1',
                    kind: 'ConfigurationPolicy',
                    metadata: { name: 'policy-set-with-1-placement-policy-1' },
                    spec: {
                        namespaceSelector: { exclude: ['kube-*'], include: ['default'] },
                        remediationAction: 'inform',
                        severity: 'low',
                    },
                },
            },
        ],
        remediationAction: 'inform',
    },
    status: {
        compliant: 'Compliant',
        placement: [
            {
                placement: 'policy-set-with-1-placement',
                placementBinding: 'policy-set-with-1-placement',
                policySet: 'policy-set-with-1-placement',
            },
        ],
        status: [{ clustername: 'local-cluster', clusternamespace: 'local-cluster', compliant: 'Compliant' }],
    },
}

const policy0: Policy = {
    apiVersion: 'policy.open-cluster-management.io/v1',
    kind: 'Policy',
    metadata: {
        name: 'test.policy-set-with-1-placement-policy',
        namespace: 'local-cluster',
        labels: {
            'policy.open-cluster-management.io/cluster-name': 'local-cluster',
            'policy.open-cluster-management.io/cluster-namespace': 'local-cluster',
            'policy.open-cluster-management.io/root-policy': 'test.policy-set-with-1-placement-policy',
        },
    },
    spec: {
        disabled: false,
        'policy-templates': [
            {
                objectDefinition: {
                    apiVersion: 'policy.open-cluster-management.io/v1',
                    kind: 'ConfigurationPolicy',
                    metadata: { name: 'policy-set-with-1-placement-policy-1' },
                    spec: {
                        namespaceSelector: { exclude: ['kube-*'], include: ['default'] },
                        remediationAction: 'inform',
                        severity: 'low',
                    },
                },
            },
        ],
        remediationAction: 'inform',
    },
    status: {
        compliant: 'Compliant',
        details: [
            {
                compliant: 'Compliant',
                history: [
                    {
                        eventName: 'test.policy-set-with-1-placement-policy.16d459c516462fbf',
                        lastTimestamp: '2022-02-16T19:07:46Z',
                        message:
                            'Compliant; notification - namespaces [test] found as specified, therefore this Object template is compliant',
                    },
                ],
                templateMeta: { creationTimestamp: null, name: 'policy-set-with-1-placement-policy-1' },
            },
        ],
    },
}

export const mockPolicy: Policy[] = [rootPolicy, policy0]

describe('Policy Details History content', () => {
    test('Should render Policy Details History Page content correctly', async () => {
        render(
            <RecoilRoot
                initializeState={(snapshot) => {
                    snapshot.set(policiesState, mockPolicy)
                }}
            >
                <MemoryRouter>
                    <PolicyDetailsHistory
                        policyName={'policy-set-with-1-placement-policy'}
                        policyNamespace={'test'}
                        clusterName={'local-cluster'}
                        templateName={'policy-set-with-1-placement-policy-1'}
                    />
                </MemoryRouter>
            </RecoilRoot>
        )

        // wait template name load
        await waitForText('Template: policy-set-with-1-placement-policy-1')

        // wait for template table load
        await waitForText('Without violations')
        await waitForText(
            'notification - namespaces [test] found as specified, therefore this Object template is compliant'
        )
    })
})
