import React, { Component } from "react";
import ReactDOM from "react-dom";
import Select from "react-select";
import trim from 'lodash/trim';
import isEmpty from 'lodash/isEmpty';
import reduce from 'lodash/reduce';

import GithubColors from "./github-colors.json";
import './styles.css';

const Config = {
  baseURL: 'https://api.github.com',
  perPage: 100, // maximum per_page allowed (https://developer.github.com/v3/#pagination)
}

class App extends Component {
  _key = null

  state = {
    data: [],
    langFilter: "All",
    page: 1,
    stopRequesting: false,
    error: null,
    loading: false,
    cached: false,
    username: null
  }

  componentDidMount() {
    const s = window.location.pathname.split('/');
    const username = s.length > 1 ? trim(s[1]) : '';
    if (isEmpty(username)) {
      return this.setState({
        error: `Username required in URL ${username}`,
        user: {},
        username: null
      });
    }

    this._key = `_gitmarks_.${username}`;
    console.log('User key:', this._key);

    this.setState({ username }, () => {
      const str = localStorage.getItem(this._key);
      let json = null;

      try {
        json = JSON.parse(str);
      } catch (error) {
        console.error(error);
      }

      if (!isEmpty(json)) {
        console.log('Loaded from cache:', json);
        return this.setState({
          data: json.data,
          cached: true
        });
      }

      this.setState({ loading: true });
      this.requestReposLoop();
    })
  }

  requestRepos() {
    const { username, page } = this.state;
    console.log(`Fetching ${username} data, page: ${page}`);
    return fetch(`${Config.baseURL}/users/${username}/starred?per_page=${Config.perPage}&page=${page}`)
      .then(res => {
        if (res.status === 404) {
          throw new Error(`User "${username}" not found.`);
        }
        if (res.status < 200 || res.status > 200) {
          throw new Error('Error fetching data from github.com.');
        }
        return res.json();
      });
  }

  requestReposLoop() {
    this.requestRepos()
      .then(json => json.map(this.formatData))
      .then((data) => {
        console.log("Response data:", data);

        // If the response data array is less that `Config.perPage`,
        // then it means that we have reached the end of the pagination and
        // we should stop sending requests.
        const stopRequesting = data.length < Config.perPage;

        this.setState(prev => ({
          cached: false,
          loading: false,
          page: prev.page + 1,
          data: prev.data.concat(data),
          stopRequesting
        }), () => {
          if (stopRequesting) {
            this.cacheData();
          } else {
            this.requestReposLoop();
          }
        });

      })
      .catch((err) => {
        console.log('Error:', err);
        this.setState({
          error: err && err.message ? err.message: `${err}`,
          stopRequesting: true,
          loading: false
        });
      });
  }

  formatData(starred) {
    return {
      owner: starred.owner.login,
      repo: starred.name,
      description: starred.description,
      language: starred.language,
      stargazers: starred.stargazers_count
    };
  }

  renderItem(i, repo = '', stars, desc, lang) {
    return (
      <div key={i} className="item">
        <div className="item-first-line">
          <a
            className="repo"
            href={`https://github.com/${repo}`}
            target="_blank"
          >
            {repo}
          </a>
          <span className="desc" title={desc}>
            {desc}
          </span>
        </div>
        <div className="item-second-line">
          {lang && <div className={`lang-color ${lang}`}/>}
          {lang && <div className={`lang`}>{lang}</div>}
          <div className="stars" title={`${stars} stars`}>
            {stars} ★
          </div>
        </div>
      </div>
    );
  }

  handleLangSelect(v) {
    this.setState({ langFilter: v.value });
  }

  applyFiler(data) {
    const { langFilter } = this.state;
    if (!langFilter || langFilter != "All") {
      return data.filter(d => d.language === langFilter);
    }
    return data;
  }

  handleReloadClick() {
    localStorage.removeItem(this._key);
    this.setState({
      loading: true,
      data: [],
      cached: false
    }, () => this.requestReposLoop());
  }

  cacheData() {
    const cache = { data: this.state.data };
    localStorage.setItem(this._key, JSON.stringify(cache));
    console.log('Cached data to localStorage', cache);
  }

  renderRepos(data) {
    const { loading, error } = this.state;
    let content = null

    if (error) {
      content = (
        <span className="item" style={{ color: 'red', margin: '5px 0px' }}>
          {error}
        </span>
      );
    } else if (loading) {
      content = <div className="item">Loading...</div>
    } else if (isEmpty(data)) {
      content = <div className="item">No data</div>
    } else {
      content = data.map(({ owner, repo, stargazers, description, language }, index) =>
        this.renderItem(
          index,
          `${owner}/${repo}`,
          stargazers,
          description || '',
          language
        ))
    }

    return (
      <div className="repos-container">
        {content}
      </div>
    );
  }

  render() {
    const { data, cached, error } = this.state;
    const filtered = this.applyFiler(data);

    return (
      <div style={{ marginTop: '70px' }}>
        <a href="/" className="logo">
          Gitmarks
        </a>
        {!error &&
          <div className="main-header">
            <div className="language-select-label">
              Language
            </div>
            <Select
              className="select-lang"
              placeholder="Select language"
              classNamePrefix="select"
              isSearchable
              onChange={e => this.handleLangSelect(e)}
              name="language"
              styles={{
                control: (s) => ({ ...s,  height: '32px', minHeight: '32px' }),
                dropdownIndicator: (s) => ({ ...s, padding: '0px 8px' })
              }}
              options={reduce(
                GithubColors,
                (acc, v, k) => acc.concat({ value: k, label: k }),
                []
              )}
            />
            <div className="repos-count">{filtered.length} repositories</div>
            <div>
              {cached && <span className="cache-state cached">cached</span>}
              {cached && <span className="reload-btn" onClick={() => this.handleReloadClick()}>Reload</span>}
            </div>
          </div>}
        {this.renderRepos(filtered)}
      </div>
    );
  }
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
