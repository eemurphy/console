/* Copyright Contributors to the Open Cluster Management project */
// Copyright (c) 2021 Red Hat, Inc.
// Copyright Contributors to the Open Cluster Management project
import { ApolloError } from '@apollo/client'
import { makeStyles } from '@material-ui/styles'
import { ButtonVariant, PageSection } from '@patternfly/react-core'
import _ from 'lodash'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { userPreferencesState } from '../../../atoms'
import { useTranslation } from '../../../lib/acm-i18next'
import { NavigationPath } from '../../../NavigationPath'
import { getUserPreference, SavedSearch, UserPreference } from '../../../resources/userpreference'
import {
    AcmActionGroup,
    AcmAlert,
    AcmButton,
    AcmDropdown,
    AcmIcon,
    AcmIconVariant,
    AcmPage,
    AcmScrollable,
    AcmSearchbar,
} from '../../../ui-components'
import HeaderWithNotification from './components/HeaderWithNotification'
import { SaveAndEditSearchModal } from './components/Modals/SaveAndEditSearchModal'
import { SearchInfoModal } from './components/Modals/SearchInfoModal'
import SavedSearchQueries from './components/SavedSearchQueries'
import { convertStringToQuery, formatSearchbarSuggestions, getSearchCompleteString } from './search-helper'
import { searchClient } from './search-sdk/search-client'
import { useGetMessagesQuery, useSearchCompleteQuery, useSearchSchemaQuery } from './search-sdk/search-sdk'
import SearchResults from './SearchResults/SearchResults'
import { transformBrowserUrlToSearchString, updateBrowserUrl } from './urlQuery'

const operators = ['=', '<', '>', '<=', '>=', '!=', '!']
const savedSearches = 'Saved searches'
const useStyles = makeStyles({
    actionGroup: {
        backgroundColor: 'var(--pf-global--BackgroundColor--100)',
        paddingRight: 'var(--pf-c-page__main-section--PaddingRight)',
        paddingLeft: 'var(--pf-c-page__main-section--PaddingLeft)',
        paddingBottom: 'var(--pf-c-page__header-sidebar-toggle__c-button--PaddingBottom)',
    },
    dropdown: {
        '& ul': {
            right: 'unset !important',
        },
    },
})

// Adds AcmAlert to page if there's errors from the Apollo queries.
function HandleErrors(schemaError: ApolloError | undefined, completeError: ApolloError | undefined) {
    const { t } = useTranslation()
    const notEnabled = 'not enabled'
    if (schemaError || completeError) {
        return (
            <div style={{ marginBottom: '1rem' }}>
                <AcmAlert
                    noClose
                    variant={
                        schemaError?.message.includes(notEnabled) || completeError?.message.includes(notEnabled)
                            ? 'info'
                            : 'danger'
                    }
                    isInline
                    title={
                        schemaError?.message.includes(notEnabled) || completeError?.message.includes(notEnabled)
                            ? t('search.filter.info.title')
                            : t('search.filter.errors.title')
                    }
                    subtitle={schemaError?.message || completeError?.message}
                />
            </div>
        )
    }
    return <Fragment />
}

function RenderSearchBar(props: {
    presetSearchQuery: string
    setSelectedSearch: React.Dispatch<React.SetStateAction<string>>
    queryErrors: boolean
    setQueryErrors: React.Dispatch<React.SetStateAction<boolean>>
    savedSearchQueries: SavedSearch[]
    userPreference?: UserPreference
}) {
    const { presetSearchQuery, queryErrors, savedSearchQueries, setQueryErrors, setSelectedSearch, userPreference } =
        props
    const { t } = useTranslation()
    const history = useHistory()
    const [currentSearch, setCurrentSearch] = useState<string>(presetSearchQuery)
    const [saveSearch, setSaveSearch] = useState<SavedSearch>()
    const [open, toggleOpen] = useState<boolean>(false)
    const toggle = () => toggleOpen(!open)

    useEffect(() => {
        setCurrentSearch(presetSearchQuery)
    }, [presetSearchQuery])

    const searchSchemaResults = useSearchSchemaQuery({
        skip: currentSearch.endsWith(':') || operators.some((operator: string) => currentSearch.endsWith(operator)),
        client: process.env.NODE_ENV === 'test' ? undefined : searchClient,
    })

    const { searchCompleteValue, searchCompleteQuery } = useMemo(() => {
        const value = getSearchCompleteString(currentSearch)
        const query = convertStringToQuery(currentSearch)
        query.filters = query.filters.filter((filter) => {
            return filter.property !== value
        })
        return { searchCompleteValue: value, searchCompleteQuery: query }
    }, [currentSearch])

    const searchCompleteResults = useSearchCompleteQuery({
        skip: !currentSearch.endsWith(':') && !operators.some((operator: string) => currentSearch.endsWith(operator)),
        client: process.env.NODE_ENV === 'test' ? undefined : searchClient,
        variables: {
            property: searchCompleteValue,
            query: searchCompleteQuery,
        },
    })

    useEffect(() => {
        if (searchSchemaResults?.error || searchCompleteResults?.error) {
            setQueryErrors(true)
        } else if (queryErrors) {
            setQueryErrors(false)
        }
    }, [searchSchemaResults, searchCompleteResults, queryErrors, setQueryErrors])

    const saveSearchTooltip = useMemo(() => {
        if (
            savedSearchQueries.find((savedQuery: SavedSearch) => savedQuery.searchText === currentSearch) !== undefined
        ) {
            return t('A saved search already exists for the current search criteria.')
        } else if (currentSearch === '' || currentSearch.endsWith(':')) {
            return t('Enter valid search criteria to save a search.')
        }
        return undefined
    }, [currentSearch, savedSearchQueries, t])

    return (
        <Fragment>
            <PageSection>
                <SaveAndEditSearchModal
                    setSelectedSearch={setSelectedSearch}
                    savedSearch={saveSearch}
                    onClose={() => setSaveSearch(undefined)}
                    savedSearchQueries={savedSearchQueries}
                    userPreference={userPreference}
                />
                <SearchInfoModal isOpen={open} onClose={() => toggleOpen(false)} />
                {HandleErrors(searchSchemaResults.error, searchCompleteResults.error)}
                <div style={{ display: 'flex' }}>
                    <AcmSearchbar
                        loadingSuggestions={searchSchemaResults.loading || searchCompleteResults.loading}
                        queryString={currentSearch}
                        suggestions={
                            currentSearch === '' ||
                            (!currentSearch.endsWith(':') &&
                                !operators.some((operator: string) => currentSearch.endsWith(operator)))
                                ? formatSearchbarSuggestions(
                                      _.get(searchSchemaResults, 'data.searchSchema.allProperties', []),
                                      'filter',
                                      '' // Dont need to de-dupe filters
                                  )
                                : formatSearchbarSuggestions(
                                      _.get(searchCompleteResults, 'data.searchComplete', []),
                                      'value',
                                      currentSearch // pass current search query in order to de-dupe already selected values
                                  )
                        }
                        currentQueryCallback={(newQuery) => {
                            setCurrentSearch(newQuery)
                            if (newQuery === '') {
                                updateBrowserUrl(history, newQuery)
                            }
                            if (newQuery !== currentSearch) {
                                setSelectedSearch(savedSearches)
                            }
                        }}
                        toggleInfoModal={toggle}
                        updateBrowserUrl={updateBrowserUrl}
                    />
                    <AcmButton
                        style={{ marginLeft: '16px', width: '138px', padding: '6px, 16px' }}
                        onClick={() =>
                            setSaveSearch({
                                id: '',
                                name: '',
                                description: '',
                                searchText: currentSearch,
                            })
                        }
                        isDisabled={
                            currentSearch === '' ||
                            currentSearch.endsWith(':') ||
                            savedSearchQueries.find(
                                (savedQuery: SavedSearch) => savedQuery.searchText === currentSearch
                            ) !== undefined
                        }
                        tooltip={saveSearchTooltip}
                        variant={'link'}
                    >
                        {t('Save search')}
                    </AcmButton>
                </div>
            </PageSection>
        </Fragment>
    )
}

function RenderDropDownAndNewTab(props: {
    selectedSearch: string
    setSelectedSearch: React.Dispatch<React.SetStateAction<string>>
    savedSearchQueries: SavedSearch[]
}) {
    const { selectedSearch, setSelectedSearch, savedSearchQueries } = props
    const classes = useStyles()
    const { t } = useTranslation()
    const history = useHistory()

    const SelectQuery = useCallback(
        (id: string) => {
            if (id === 'savedSearchesID') {
                updateBrowserUrl(history, '')
                setSelectedSearch(savedSearches)
            } else {
                const selectedQuery = savedSearchQueries.filter((query) => query.id === id)
                updateBrowserUrl(history, selectedQuery[0].searchText || '')
                setSelectedSearch(selectedQuery[0].name || '')
            }
        },
        [history, savedSearchQueries, setSelectedSearch]
    )

    function SavedSearchDropdown(props: { selectedSearch: string; savedSearchQueries: SavedSearch[] }) {
        const dropdownItems: any[] = useMemo(() => {
            const items: any[] = props.savedSearchQueries.map((query) => {
                return { id: query.id, text: query.name }
            })
            items.unshift({ id: 'savedSearchesID', text: savedSearches })
            return items
        }, [props.savedSearchQueries])

        return (
            <div className={classes.dropdown}>
                <AcmDropdown
                    isDisabled={false}
                    id="dropdown"
                    onSelect={(id) => {
                        SelectQuery(id)
                    }}
                    text={props.selectedSearch}
                    dropdownItems={dropdownItems}
                    isKebab={false}
                />
            </div>
        )
    }

    return (
        <div className={classes.actionGroup}>
            <AcmActionGroup>
                <SavedSearchDropdown selectedSearch={selectedSearch} savedSearchQueries={savedSearchQueries} />
                <AcmButton
                    href={NavigationPath.search}
                    variant={ButtonVariant.link}
                    component="a"
                    target="_blank"
                    rel="noreferrer"
                    id={'newsearchtab'}
                    icon={<AcmIcon icon={AcmIconVariant.openNewTab} />}
                    iconPosition="right"
                >
                    {t('Open new search tab')}
                </AcmButton>
            </AcmActionGroup>
        </div>
    )
}

export default function SearchPage() {
    // Only using setCurrentQuery to trigger a re-render
    // useEffect using window.location to trigger re-render doesn't work cause react hooks can't use window
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {
        presetSearchQuery = '',
        preSelectedRelatedResources = [], // used to show any related resource on search page navigation
    } = transformBrowserUrlToSearchString(window.location.search || '')
    const [userPreferences] = useRecoilState(userPreferencesState)
    const [selectedSearch, setSelectedSearch] = useState(savedSearches)
    const [queryErrors, setQueryErrors] = useState(false)
    const [queryMessages, setQueryMessages] = useState<any[]>([])
    const [userPreference, setUserPreference] = useState<UserPreference | undefined>(undefined)

    useEffect(() => {
        getUserPreference(userPreferences).then((resp) => setUserPreference(resp))
    }, [userPreferences])

    const userSavedSearches = useMemo(() => {
        return userPreference?.spec?.savedSearches ?? []
    }, [userPreference])

    useEffect(() => {
        if (presetSearchQuery === '') {
            setSelectedSearch(savedSearches)
        }
    }, [presetSearchQuery])

    const query = convertStringToQuery(presetSearchQuery)
    const msgQuery = useGetMessagesQuery({
        client: process.env.NODE_ENV === 'test' ? undefined : searchClient,
    })
    useEffect(() => {
        if (msgQuery.data?.messages) {
            setQueryMessages(msgQuery.data?.messages)
        }
    }, [msgQuery.data])

    return (
        <AcmPage
            header={
                <div>
                    <HeaderWithNotification messages={queryMessages} />
                    <RenderDropDownAndNewTab
                        selectedSearch={selectedSearch}
                        setSelectedSearch={setSelectedSearch}
                        savedSearchQueries={userSavedSearches}
                    />
                </div>
            }
        >
            <AcmScrollable>
                <RenderSearchBar
                    presetSearchQuery={presetSearchQuery}
                    setSelectedSearch={setSelectedSearch}
                    queryErrors={queryErrors}
                    setQueryErrors={setQueryErrors}
                    savedSearchQueries={userSavedSearches}
                    userPreference={userPreference}
                />
                {!queryErrors &&
                    (presetSearchQuery !== '' && (query.keywords.length > 0 || query.filters.length > 0) ? (
                        <SearchResults
                            currentQuery={presetSearchQuery}
                            preSelectedRelatedResources={preSelectedRelatedResources}
                        />
                    ) : (
                        <SavedSearchQueries
                            savedSearches={userSavedSearches}
                            setSelectedSearch={setSelectedSearch}
                            userPreference={userPreference}
                        />
                    ))}
            </AcmScrollable>
        </AcmPage>
    )
}
