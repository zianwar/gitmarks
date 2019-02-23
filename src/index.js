import React, { Component } from "react";
import ReactDOM from "react-dom";
import gcolors from "./github-colors.json";
import Select from "react-select";
import "./styles.css";
import _ from "lodash";

class App extends Component {
  constructor(...a) {
    super(...a);
    this.state = {
      data: [],
      langFilter: "All",
      page: 1,
      stop: false,
      error: null,
      loading: false,
      cached: false,
      username: null
    };
    this._key = null;
    this.fetchStarred = this.fetchStarred.bind(this);
  }

  componentDidMount() {
    const s = window.location.pathname.split('/');
    const username = s.length > 1 ? _.trim(s[1]) : '';
    if (_.isEmpty(username)) {
      this.setState({
        error: `Username required in URL ${username}`,
        user: {},
        username: null
      });
      return
    }

    this._key = `_gitmarks_.${username}`;
    console.log('key:', this._key);

    this.setState({ username }, () => {
      const str = localStorage.getItem(this._key);
      let json = null;

      try {
        json = JSON.parse(str);
      } catch (error) {
        console.error(error);
      }

      if (!_.isEmpty(json)) {
        console.log('got json:', json);
        this.setState({
          data: json.data,
          cached: true
        });
        return
      }

      this.setState({ loading: true });
      this.fetchStarred();
    })
  }

  fetchStarred() {
    const { username, page } = this.state;
    console.log('fetching for username:', username,'page:', page)
    return fetch(`https://api.github.com/users/${username}/starred?per_page=100&page=${page}`)
      .then(res => {
        if (res.status === 404) {
          throw new Error(`User "${username}" not found.`);
        }
        if (res.status < 200 || res.status > 200) {
          throw new Error('Error fetching data from github.com.');
        }
        return res.json();
      })
      .then(json => {
        console.log('Response body:', json);
        return json.map(this.formatData);
      })
      .then(data => {
        console.log("fetched", data.length, data);
        const stop = data.length <= 10;

        this.setState(prev => ({
          cached: false,
          loading: false,
          page: prev.page + 1,
          data: [...prev.data, ...data],
          stop
        }), () => {
          if (stop) {
            this.cacheData();
          } else {
            this.fetchStarred();
          }
        });

      })
      .catch(err => {
        console.log('Error:', err);
        this.setState({
          error: err && err.message ? err.message: `${err}`,
          stop: true,
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
        <div className="header">
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
        <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center' }}>
          {lang && <div className={`lang-dot ${lang}`}/>}
          {lang && <div className={`language`}>{lang}</div>}
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
    }, () => this.fetchStarred());
  }

  cacheData() {
    localStorage.setItem(this._key, JSON.stringify({
      data: this.state.data
    }));
    console.log('cached data to localStorage');
  }

  renderRepos() {
    const data = this.applyFiler(this.state.data)

    let content = null
    if (this.state.error) {
      content = <span className="item" style={{ color: 'red', margin: '5px 0px' }}>{this.state.error}</span>
    } else if (this.state.loading) {
      content = <div className="item">Loading...</div>
    } else if (_.isEmpty(this.state.data)) {
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
    )
  }

  render() {
    return (
      <div style={{ marginTop: '70px' }}>
        <a href="/" style={{ textDecoration: 'none', color:'black', textTransform: 'uppercase', letterSpacing: '0.2rem', margin: '60px 80px', display: 'flex' }}>
          Gitmarks
        </a>
        {!this.state.error &&
          <div style={{ margin: '60px 80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div
                style={{ fontSize: "13px", display: "flex", alignItems: "center" }}
              >
                <div style={{ marginRight: "20px", letterSpacing: '0.05rem', textTransform: 'uppercase', fontSize: '13px', color: 'gray' }}> Language</div>
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
                  options={_.reduce(
                    gcolors,
                    (acc, v, k) => acc.concat({ value: k, label: k }),
                    []
                  )}
                />
                <div style={{ marginLeft: '35px', marginRight: '20px', color: 'gray' }}>{this.applyFiler(this.state.data).length} repositories</div>
                <div>
                  {this.state.cached && <span className="cache-state cached">cached</span>}
                  {this.state.cached && <span style={{ color: '#0074d9', cursor: 'pointer' }} onClick={() => this.handleReloadClick()}>Reload</span>}
                </div>
              </div>
            </div>
          </div>}
        {this.renderRepos()}
      </div>
    );
  }
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
