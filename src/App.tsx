import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Input } from "./components/input";
import { Button } from "./components/button";

interface Repo {
  id: number;
  name: string;
  html_url: string;
}

interface CommitData {
  month: string;
  commits: number;
}

// Configure your GitHub token here
const GITHUB_TOKEN = process.env.REACT_APP_GITHUB_TOKEN;

export default function GitHubActivityViewer() 
{
  const [username, setUsername] = useState<string>("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [commitData, setCommitData] = useState<CommitData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showChart, setShowChart] = useState(false);

  // Function to fetch with authentication
  const fetchWithAuth = async (url: string) => {
    try {
      const headers: Record<string, string> = {
        Authorization: `token ${GITHUB_TOKEN}`
      };

      return await fetch(url, { headers });
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  };

  const fetchReposAndYears = async () => {
    if (!username) {
      setError("Please enter a GitHub username");
      return;
    }
    
    setLoading(true);
    setError("");
    setCommitData([]);
    setRepos([]);
    setYears([]);
    setShowChart(false);

    try {
      // First fetch user data to get account creation year
      const userRes = await fetchWithAuth(`https://api.github.com/users/${username}`);
      
      if (!userRes.ok) {
        if (userRes.status === 404) {
          throw new Error("User not found");
        } else if (userRes.status === 403) {
          throw new Error("API rate limit exceeded or authentication issue");
        } else if (userRes.status === 401) {
          throw new Error("Invalid GitHub token. Check your configuration.");
        } else {
          throw new Error(`GitHub API error: ${userRes.status}`);
        }
      }
      
      const userData = await userRes.json();

      // Calculate year range
      const createdYear = new Date(userData.created_at).getFullYear();
      const currentYear = new Date().getFullYear();
      const yearRange = Array.from(
        { length: currentYear - createdYear + 1 },
        (_, i) => createdYear + i
      ).reverse();

      setYears(yearRange);
      setSelectedYear(currentYear);

      // Fetch repositories
      const reposRes = await fetchWithAuth(
        `https://api.github.com/users/${username}/repos?per_page=100`
      );
      
      if (!reposRes.ok) {
        throw new Error(`Failed to fetch repositories: ${reposRes.status}`);
      }
      
      const reposData = await reposRes.json();
      setRepos(reposData);

      // Fetch commit data for current year
      if (reposData.length > 0) {
        await fetchCommits(currentYear, reposData);
      } else {
        setLoading(false);
        setError("No repositories found for this user");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      setLoading(false);
    }
  };

  const fetchCommits = async (year: number, customRepos: Repo[] = repos) => {
    if (customRepos.length === 0) return;
    
    setLoading(true);
    setCommitData([]);
    setShowChart(false);
    setError("");

    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const monthlyCommits: CommitData[] = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(year, i).toLocaleString("default", { month: "short" }),
        commits: 0,
      }));

      // With token authentication we can process more repos
      // Still limit to avoid excessive page loads
      const reposToProcess = customRepos.slice(0, 25);
      
      // Show a loading indicator with progress
      let processedRepos = 0;
      const totalRepos = reposToProcess.length;

      for (const repo of reposToProcess) {
        processedRepos++;
        
        // Fetch all commits for the year in one request
        const since = new Date(year, 0, 1).toISOString();
        let until = new Date(year, 11, 31, 23, 59, 59).toISOString();
        
        if (year === currentYear && new Date(until) > now) {
          until = now.toISOString();
        }

        try {
          // We might need to paginate if there are many commits
          let page = 1;
          let hasMoreCommits = true;
          
          while (hasMoreCommits) {
            const res = await fetchWithAuth(
              `https://api.github.com/repos/${username}/${repo.name}/commits?since=${since}&until=${until}&per_page=100&page=${page}`
            );

            if (res.ok) {
              const commits = await res.json();
              
              // Process this page of commits
              commits.forEach((commit: any) => {
                const commitDate = new Date(commit.commit.author.date);
                const monthIndex = commitDate.getMonth();
                monthlyCommits[monthIndex].commits += 1;
              });
              
              // Check if we need to fetch more pages
              hasMoreCommits = commits.length === 100; // GitHub returns max 100 per page
              page++;
              
              // Safety check to prevent too many requests
              if (page > 5) {
                hasMoreCommits = false; // Limit to 500 commits per repo
              }
            } else if (res.status === 409 || res.status === 404) {
              // Empty or non-existent repo, skip
              hasMoreCommits = false;
            } else {
              console.warn(`Error fetching commits for ${repo.name}: ${res.status}`);
              hasMoreCommits = false;
            }
          }
        } catch (repoError) {
          console.error(`Error processing repo ${repo.name}:`, repoError);
          // Continue with other repos
        }
      }

      setCommitData(monthlyCommits);
      setShowChart(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to fetch commit data");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    await fetchReposAndYears();
  };

  const handleYearChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const year = parseInt(e.target.value);
    setSelectedYear(year);
    await fetchCommits(year);
  };

  // Handle Enter key press in the input field
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4 text-center">GitHub Activity Viewer</h1>

      <div className="flex gap-2 mb-6 justify-center">
        <Input
          placeholder="Enter GitHub username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full max-w-md"
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? "Loading..." : "Search"}
        </Button>
      </div>

      {error && (
        <div className="text-red-500 text-center mb-4 p-2 border border-red-200 rounded bg-red-50">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center my-8">
          <div className="animate-pulse text-center">
            <p>Loading data...</p>
            <p className="text-sm text-gray-500 mt-2">
              This may take a moment depending on the number of repositories
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Repositories list */}
        <div className="md:col-span-1">
          {repos.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">
                Repositories ({repos.length})
              </h2>
              <div className="max-h-96 overflow-y-auto border rounded-md p-2">
                <ul className="space-y-1">
                  {repos.map((repo) => (
                    <li key={repo.id} className="truncate">
                      <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {repo.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Year selector and commit chart */}
        <div className="md:col-span-2">
          {years.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Commit Activity</h2>
                <select
                  className="border border-gray-300 px-3 py-1 rounded-md text-sm"
                  value={selectedYear ?? ""}
                  onChange={handleYearChange}
                  disabled={loading}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              {showChart && commitData.length > 0 && (
                commitData.every((d) => d.commits === 0) ? (
                  <div className="text-center text-gray-500 p-8 border rounded-md">
                    No commits found for {selectedYear}.
                  </div>
                ) : (
                  <div className="border rounded-md p-4 bg-white">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={commitData}>
                        <XAxis dataKey="month" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="commits" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Summary information */}
                    <div className="mt-4 text-sm text-gray-600">
                      <p>Total commits in {selectedYear}: {commitData.reduce((sum, data) => sum + data.commits, 0)}</p>
                      <p>Most active month: {commitData.reduce((max, data) => data.commits > max.commits ? data : max, commitData[0]).month}</p>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}